from typing import Annotated, NotRequired, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama

model1 = "qwen2.5:1.5b"
model2 = "qwen2.5:7b"

model = ChatOllama(model=model1)

class State(TypedDict):
  #messages have the type "list". The `add_messages`
  #function in the annotation defines how this state should be
  #updated (in this case, it appends new messages to the
  #list, rather than replacing the previous messages)
  messages: Annotated[list, add_messages]

def chatbot(state: State):
  answer = model.invoke(state["messages"])
  return {"messages": [answer]}

builder = StateGraph(State)
builder.add_node("chatbot", chatbot)
builder.add_edge(START, 'chatbot')
builder.add_edge('chatbot', END)

graph = builder.compile()

# graph.get_graph().draw_mermaid_png()

input_state: State = {"messages": [HumanMessage("hi!")]}
for chunk in graph.stream(input_state):
  print(chunk)

from langchain_core.messages import SystemMessage

#useful to generate SQL query
model_low_temp = ChatOllama(model=model1, temperature=0.1)

#useful to generate natural language outputs
model_high_temp = ChatOllama(model=model1, temperature=0.7)

class SQLState(TypedDict):
  #to track conversation history
  messages: Annotated[list, add_messages]
  #input
  user_query: NotRequired[str]
  #output
  sql_query: NotRequired[str]
  sql_explanation: NotRequired[str]

class Input(TypedDict):
  user_query: str

class Output(TypedDict):
  sql_query: str
  sql_explanation: str

generate_prompt = SystemMessage(
  """You are a SQL generator.
Return ONLY a valid SQL query.
Do not include markdown, code fences, comments, or natural-language explanation.
If schema is unknown, return a reasonable generic SQL query using placeholder table/column names."""
)

def generate_sql(state: SQLState) -> SQLState:
  user_query = state.get("user_query", "")
  user_message = HumanMessage(user_query)
  prior_messages = state.get("messages", [])
  messages = [generate_prompt, *prior_messages, user_message]
  res = model_low_temp.invoke(messages)
  sql_query = res.content if isinstance(res.content, str) else str(res.content)
  return {
    "sql_query": sql_query,
    "sql_explanation": "",
    #update conversation history
    "messages": [user_message, res],
  }

explain_prompt = SystemMessage("""You are a helpful data analyst who explains SQL
                                queries to users.""")

def explain_sql(state: SQLState) -> SQLState:
  user_query = state.get("user_query", "")
  sql_query = state.get("sql_query", "")
  prior_messages = state.get("messages", [])
  explain_request = HumanMessage(
    f"User question: {user_query}\n\nSQL query:\n{sql_query}\n\n"
    "Explain what this SQL does in simple terms."
  )
  messages = [
    explain_prompt,
    *prior_messages,
    explain_request,
  ]
  res = model_high_temp.invoke(messages)
  sql_explanation = res.content if isinstance(res.content, str) else str(res.content)
  return {
    "sql_explanation": sql_explanation,
    #update conv history
    "messages": [explain_request, res],
  }
  
builder = StateGraph(SQLState, input_schema=Input, output_schema=Output)
builder.add_node("generate_sql", generate_sql)
builder.add_node("explain_sql", explain_sql)
builder.add_edge(START, "generate_sql")
builder.add_edge("generate_sql", "explain_sql")
builder.add_edge("explain_sql", END)
graph = builder.compile()

res = graph.invoke({
  "user_query": "What is the total sales for each product?"
})
# print(res)

from typing import Annotated, Literal, NotRequired, TypedDict

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.vectorstores.in_memory import InMemoryVectorStore
from langchain_ollama import ChatOllama, OllamaEmbeddings

from langgraph.graph import END,START, StateGraph
from langgraph.graph.message import add_messages

embeddings = OllamaEmbeddings(model=model1)
#useful to generate SQL  query
model_low_temp = ChatOllama(model=model1, temperature=0.1)
#useful to generate natural language outputs
model_high_temp = ChatOllama(model=model1, temperature=0.7)

class DomainState(TypedDict):
  #to track conversation history
  messages: NotRequired[Annotated[list, add_messages]]
  #input
  user_query: str
  #output
  domain: NotRequired[Literal["records", "insurance"]]
  documents: NotRequired[list[Document]]
  answer: NotRequired[str]
  
class DomainInput(TypedDict):
  user_query: str
  
class DomainOutput(TypedDict):
  documents: list[Document]
  answer: str

#refer to Chapter 2 on how to fill a vector store with documents
medical_records_store = InMemoryVectorStore.from_documents([], embeddings)
medical_records_retriever = medical_records_store.as_retriever()

insurance_faqs_store = InMemoryVectorStore.from_documents([], embeddings)
insurance_faqs_retriever = insurance_faqs_store.as_retriever()

router_prompt = SystemMessage(
  """
  You need to decide which domain to route the user query to. You have two 
        domains to choose from:
          - records: contains medical records of the patient, such as 
          diagnosis, treatment, and prescriptions.
          - insurance: contains frequently asked questions about insurance 
          policies, claims, and coverage.
          
Output only the domain name.
  """
)

def router_node(state: DomainState) -> DomainState:
  user_message = HumanMessage(state["user_query"])
  prior_messages = state.get("messages", [])
  messages = [router_prompt, *prior_messages, user_message]
  res = model_low_temp.invoke(messages)

  raw_content = res.content if isinstance(res.content, str) else str(res.content)
  normalized = raw_content.strip().lower()
  domain: Literal["records", "insurance"] = (
    "records" if "record" in normalized else "insurance"
  )

  return {
    "user_query": state["user_query"],
    "domain": domain,
    #update conversation history
    "messages": [user_message, res],
  }

def pick_retriever(
  state: DomainState,
) -> Literal["retrieve_medical_records", "retrieve_insurance_faqs"]:
  domain = state.get("domain", "insurance")
  if domain == "records":
    return "retrieve_medical_records"
  else:
    return "retrieve_insurance_faqs"

def retrieve_medical_records(state: DomainState) -> DomainState:
  documents = medical_records_retriever.invoke(state["user_query"])
  return {
    "user_query": state["user_query"],
    "documents": documents,
  }

def retrieve_insurance_faqs(state: DomainState) -> DomainState:
  documents = insurance_faqs_retriever.invoke(state["user_query"])
  return {
    "user_query": state["user_query"],
    "documents": documents,
  }

medical_records_prompt = SystemMessage(
  """You are a helpful medical chatbot who answers questions based on the 
        patient's medical records, such as diagnosis, treatment, and 
        prescriptions."""
)

insurance_faqs_prompt = SystemMessage(
  """You are a helpful medical insurance chatbot who answers frequently asked 
        questions about insurance policies, claims, and coverage."""
)

def generate_answer(state: DomainState) -> DomainState:
  domain = state.get("domain", "insurance")
  if domain == "records":
    prompt = medical_records_prompt
  else:
    prompt = insurance_faqs_prompt
  prior_messages = state.get("messages", [])
  documents = state.get("documents", [])
  messages = [
    prompt,
    *prior_messages,
    HumanMessage(f"Documents: {documents}"),
  ]
  res = model_high_temp.invoke(messages)
  answer = res.content if isinstance(res.content, str) else str(res.content)
  return {
    "user_query": state["user_query"],
    "answer": answer,
    #update conversation history
    "messages": [res],
  }

builder = StateGraph(DomainState, input_schema=DomainInput, output_schema=DomainOutput)
builder.add_node("router", router_node)
builder.add_node("retrieve_medical_records", retrieve_medical_records)
builder.add_node("retrieve_insurance_faqs", retrieve_insurance_faqs)
builder.add_node("generate_answer", generate_answer)
builder.add_edge(START, "router")
builder.add_conditional_edges("router", pick_retriever)
builder.add_edge("retrieve_medical_records", "generate_answer")
builder.add_edge("retrieve_insurance_faqs", "generate_answer")
builder.add_edge("generate_answer", END)
graph = builder.compile()

input_state: DomainInput = {
  "user_query": "Am I covered for COVID-19 treatment?"
}
for c in graph.stream(input_state):
  print(c)

