from langchain_community.document_loaders import TextLoader
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_postgres.vectorstores import PGVector

#load doc, split into chunks
raw_documents = TextLoader('./test.txt', encoding='utf-8').load()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000,
                                                chunk_overlap=200)
documents = text_splitter.split_documents(raw_documents)

#embed each chunk and insert it into the vector store
model = OllamaEmbeddings(model="qwen2.5:1.5b")
connection = 'postgresql+psycopg://langchain:langchain@localhost:6024/langchain'
db = PGVector.from_documents(documents, model, connection=connection)

#create retriever
retriever = db.as_retriever()

#fetch relevant documents
docs = retriever.invoke("""
                        Who are the key figures in the ancient greek
                        history of philosophy?""")

#create retriever with k=2
retriever = db.as_retriever(search_kwargs={"k": 2}) #number of docs to fetch from vector store
#fetch the 2 most relevant docs
docs = retriever.invoke("""Who are the key figures in the ancient greek history of philosophy""")

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama

retriever = db.as_retriever()
prompt = ChatPromptTemplate.from_template("""Answer the question
                                          based only of the following
                                          context:
                                          {context}
                                          
                                          Question: {question}
                                          """)

llm = ChatOllama(model="qwen2.5:1.5b", temperature=0)
chain = prompt | llm

# fetch relevant docs with the public API
question = "Who are the key figures in the ancient greek history of philosophy?"
docs = retriever.invoke(question)

# convert Document objects to plain text before passing them to the prompt
context = "\n\n".join(doc.page_content for doc in docs)

# run
# print(chain.invoke({"context": context, "question": question}))

###

from langchain_core.runnables import chain

retriever = db.as_retriever()
prompt = ChatPromptTemplate.from_template("""Answer the question based only on 
    the following context:
{context}
Question: {question}
""")

llm = ChatOllama(model="qwen2.5:1.5b", temperature=0)

# @chain
# def qa(input):
#   # Public API (pas de run_manager à passer)
#   docs = retriever.invoke(question)
#   # Convertit List[Document] -> str
#   context = "\n\n".join(doc.page_content for doc in docs)

#   # Prompt -> LLM
#   formatted = prompt.invoke({"context": context, "question": question})
#   return llm.invoke(formatted)

# print(qa.invoke("Who are the key figures in the ancient greek history of philosophy?").content)

@chain
def qa(input):
  #fetch relevant docs
  docs = retriever.invoke(input)
  #convert Document objects to plain text
  context = "\n\n".join(doc.page_content for doc in docs)
  #format prompt
  formatted = prompt.invoke({"context": context, "question": input})
  #gen answer
  answer = llm.invoke(formatted)
  return answer

res = qa.invoke("""Today I woke up and brushed my teeth, then I sat down to read the 
    news. But then I forgot the food on the cooker. Who are some key figures in 
    the ancient greek history of philosophy?""")

# print(res.content)

rewrite_prompt = ChatPromptTemplate.from_template("""Provide a better search 
    query for web search engine to answer the given question, end the queries 
    with ’**’. Question: {x} Answer:""")

def parse_rewriter_output(message):
  return message.content.strip('"').strip("**")

rewriter = rewrite_prompt | llm | parse_rewriter_output

@chain
def qa_rrr(input):
  #rewrite the query
  new_query = rewriter.invoke(input)
  #fetch relevant docs
  docs = retriever.invoke(input)
  #convert Document objects to plain text
  context = "\n\n".join(doc.page_content for doc in docs)
  #format prompt
  formatted = prompt.invoke({"context": context, "question": input})
  #generate answer
  answer = llm.invoke(formatted)
  return answer

#run
res = qa_rrr.invoke("""Today I woke up and brushed my teeth, then I sat down to read 
    the news. But then I forgot the food on the cooker. Who are some key 
    figures in the ancient greek history of philosophy?""")

# print(res.content)

#resume at: chapter3, multi-query retrieval

perspectives_prompt = ChatPromptTemplate.from_template("""You are an AI language 
    model assistant. Your task is to generate five different versions of the 
    given user question to retrieve relevant documents from a vector database. 
    By generating multiple perspectives on the user question, your goal is to 
    help the user overcome some of the limitations of the distance-based 
    similarity search. Provide these alternative questions separated by 
    newlines. Original question: {question}""")

def parse_queries_output(message):
  return message.content.split('\n')

query_gen = perspectives_prompt | llm | parse_queries_output

def get_unique_union(document_lists):
  #flatten list of lists, and dedupe them
  deduped_docs = {
    doc.page_content: doc
    for sublist in document_lists for doc in sublist
  }
  #return a flat list of unique docs
  return list(deduped_docs.values())

retrieval_chain = query_gen | retriever.batch | get_unique_union

prompt = ChatPromptTemplate.from_template("""Answer the following question based 
    on this context:
{context}
Question: {question}
""")

@chain
def multi_query_qa(input):
  #fetch relevant documents
  docs = retrieval_chain.invoke(input)
  #format prompt
  formatted = prompt.invoke({"context":docs, "question":input})
  #generate answer
  answer = llm.invoke(formatted)
  return answer

#run
multi_query_qa.invoke("""Who are some key figures in the ancient greek history of philosophy?""")

prompt_rag_fusion = ChatPromptTemplate.from_template("""You are a helpful 
    assistant that generates multiple search queries based on a single input 
    query. \n
    Generate multiple search queries related to: {question} \n
    Output (4 queries):""")

# def parse_queries_output(message):
#   return message.content.split('\n')

ollama_model = "qwen2.5:1.5b"

llm = ChatOllama(model=ollama_model, temperature=0)

query_gen = prompt_rag_fusion | llm | parse_queries_output

def reciprocal_rank_fusion(results: list[list], k=60):
  """reciprocal rank fusion on multiple lists of ranked documents 
      and an optional parameter k used in the RRF formula
  """
  
  #init a dictionary to hold fused scores for each document
  #documents will be keyed by their contents to ensure uniqueness
  fused_scores = {}
  documents = {}
  
  #iterate through each list of ranked documents
  for docs in results:
    #iterate through each document in the list,
    #with its rank (position in the list)
    for rank, doc in enumerate(docs):
      #use the document contents as the key for uniqueness
      doc_str = doc.page_content
      #if the document hasn't been seen yet,
      #- init score to 0
      #- save it for later
      if doc_str not in fused_scores:
        fused_scores[doc_str]= 0
        documents[doc_str]= doc
      #update the score of the document using the RRF formula
      # 1 / (rank + k)
      fused_scores[doc_str] += 1 / (rank + k)
  #sort the docs based on their fused scores in descending order
  #to get the final reranked results
  reranked_doc_strs = sorted(
    fused_scores, key=lambda d: fused_scores[d], reverse=True
  )
  # retrieve the corresponding doc for each doc_str
  return [
    documents[doc_str]
    for doc_str in reranked_doc_strs
  ]

retrieval_chain = query_gen | retriever.batch | reciprocal_rank_fusion

prompt = ChatPromptTemplate.from_template("""Answer the following question based 
    on this context:
{context}
Question: {question}
""")
llm = ChatOllama(model=ollama_model,temperature=0)

multi_query_qa.invoke("""Who are some key figures in the ancient greek history 
    of philosophy?""")

from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama
from langchain_core.runnables import RunnableLambda

prompt_hyde = ChatPromptTemplate.from_template("""Please write a passage to answer the question. \n Question: {question} \n Passage:""")

generate_doc = (
  prompt_hyde | ChatOllama(model=ollama_model, temperature=0) | StrOutputParser()
)

retrieval_chain=generate_doc | retriever

prompt = ChatPromptTemplate.from_template("""Answer the following question based 
    on this context:
{context}
Question: {question}
""")
llm = ChatOllama(model=ollama_model,temperature=0)
@chain
def qa(input):
  # fetch relevant documents from the hyde retrieval chain defined earlier
  docs = retrieval_chain.invoke(input)
  # format prompt
  formatted = prompt.invoke({"context": docs, "question": input})
  # generate answer
  answer = llm.invoke(formatted)
  return answer

qa.invoke("""Who are some key figures in the ancient greek history of philosophy?""")

#resume at: Query Routing
from typing import Literal
from pydantic import BaseModel, Field

#data model
class RouteQuery(BaseModel):
  """Route a user query to the most relevant datasource."""
  
  datasource: Literal["python_docs", "js_docs"] = Field(
    ...,
    description="""Given a user question, choose which datasource would be relevant
                  for answering their question
    """,
  )

#LLM with function call
llm = ChatOllama(model=ollama_model, temperature=0)
structured_llm = llm.with_structured_output(RouteQuery, method="json_mode")

#prompt
system = """You are an expert at routing a user question to the
  appropriate data source.
  
  Based on the programming language the question is reffering to, route it
  to the relevant data source."""

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "{question}"),
    ]
)

#define router
router = prompt | structured_llm

question = """Why doesn't the following code work:

from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages(["human, "speak in {language}])
prompt.invoke("french")
"""

result = router.invoke({"question": question})

print(result["datasource"] if isinstance(result, dict) else result.datasource) #type: ignore
#"python_docs"

def choose_route(result):
  if "python_docs" in result.datasource.lower():
    ### Logic here
    return "chain for python_docs"
  else:
    ### Logic here
    return "chain for js_docs"

full_chain = router | RunnableLambda(choose_route)

#resume at: Semantic Routing