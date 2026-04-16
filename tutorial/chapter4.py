#using LangGraph to Add Memory to your chatbot!

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama

prompt = ChatPromptTemplate.from_messages([
  ("system", """You are a helpful assistant. Answer all questions
      to the best of your ability."""),
  ("placeholder", "{messages}")
])

model1 = "qwen2.5:1.5b"
model2 = "qwen2.5:7b"

model = ChatOllama(model=model1)

chain = prompt | model

# res = chain.invoke({
#   "messages": [
#     ("human","""Translate this sentence from English to French:
#       I love programming/"""),
#     ("ai", "J'adore programmer."),
#     ("human", "What did you just say?"),
#   ],
# })

# print(res.content)

###

from typing import Annotated, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class State(TypedDict):
  #messages have the type "list". The `add_messages`
  #function in the annotation defines how this state should
  #be updated (in this case, it appends new messages to the
  #list, rather than replacing previous messages)
  messages: Annotated[list, add_messages]

builder = StateGraph(State)

###

model = ChatOllama(model=model1)

def chatbot(state: State):
  answer = model.invoke(state["messages"])
  return {"messages": [answer]}

#the first argument is the unique node name
#the second argument is the function or Runnable to run
builder.add_node("chatbot", chatbot)

builder.add_edge(START, 'chatbot')
builder.add_edge('chatbot', END)

graph = builder.compile()

# mermaid_code = graph.get_graph().draw_mermaid()
# with open("graph.mmd", "w") as f:
#     f.write(mermaid_code)
# print("Mermaid diagram saved to graph.mmd")
# print(mermaid_code)

# input_data: State = {"messages": [HumanMessage('hi!')]}
# for chunk in graph.stream(input_data):
#     print(chunk)

from langgraph.checkpoint.memory import MemorySaver

graph = builder.compile(checkpointer=MemorySaver())

thread1 = RunnableConfig(configurable={"thread_id": "1"})
result_1 = graph.invoke(
  { "messages": [HumanMessage("hi, my name is Jack!")]},
  thread1
)
# { "chatbot": { "messages": [AIMessage("How can I help you, Jack?")]}}

result_2 = graph.invoke(
  { "messages": [HumanMessage("what is my name?")] },
  thread1
)
# { "chatbot" { "messages": [AIMessage("Your name is Jack")] } }

graph.get_state(thread1)

graph.update_state(thread1, {"messages": [HumanMessage("I like LLMs")]})

from langchain_core.messages import SystemMessage, trim_messages, AIMessage

trimmer = trim_messages(
  max_tokens=65,
  strategy="last",
  token_counter=ChatOllama(model=model1),
  include_system=True,
  allow_partial=False,
  start_on="human",
)

messages = [
  SystemMessage(content="you're a good assistant"),
  HumanMessage(content="hi! I'm bob"),
  AIMessage(content="hi!"),
  HumanMessage(content="I like vanilla ice cream"),
  AIMessage(content="nice"),
  HumanMessage(content="what's 2 + 2"),
  AIMessage(content="4"),
  HumanMessage(content="thanks"),
  AIMessage(content="no problem!"),
  HumanMessage(content="having fun?"),
  AIMessage(content="yes!"),
]

# res = trimmer.invoke(messages)
# print(res)

from langchain_core.messages import (
  AIMessage, HumanMessage,
  SystemMessage, filter_messages,
)

messages = [
  SystemMessage("you are a good assistant", id="1"),
  HumanMessage("example input", id="2", name="example_user"),
  AIMessage("example output", id="3", name="example_assistant"),
  HumanMessage("real input", id="4", name="bob"),
  AIMessage("real output", id="5", name="alice"),
]

filter_messages(messages, include_types="human")

filter_messages(messages, exclude_names=["example_user", "example_assistant"])

"""
[SystemMessage(content='you are a good assistant', id='1'),
HumanMessage(content='real input', name='bob', id='4'),
AIMessage(content='real output', name='alice', id='5')]
"""

filter_messages(
  messages,
  include_types=[HumanMessage, AIMessage],
  exclude_ids=["3"]
)

"""
[HumanMessage(content='example input', name='example_user', id='2'),
 HumanMessage(content='real input', name='bob', id='4'),
 AIMessage(content='real output', name='alice', id='5')]
"""

#resume at: Merging consecutive Messages
from langchain_core.messages import (
  AIMessage,
  HumanMessage,
  SystemMessage,
  merge_message_runs,
)

messages = [
  SystemMessage("you're a good assistant."),
  SystemMessage("you always respond with a joke."),
  HumanMessage(
    [{"type": "text", "text": "i wonder why it's called langchain"}]
  ),
  HumanMessage("and who is harrison chasing anyway"),
  AIMessage(
    '''Well, I guess they thought "WordRope" and "SentenceString" just didn\'t
    have the same ring to it!'''
  ),
  AIMessage("""Why, he's probably chasing after the last cup of coffee in the office!"""),
]

merge_message_runs(messages)

###

model = ChatOllama(model=model1)
merger= merge_message_runs()
chain = merger | model

