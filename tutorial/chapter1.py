from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage

# MODELS: tinyllama, qwen2.5:1.5b

# model = ChatOllama(model="tinyllama", temperature=0.999)
# print(model)
# response = model.invoke([HumanMessage(content="The sky is")])
# print(response)
# print(response.content)

# model = ChatOllama(model="qwen2.5:1.5b")
# system_msg = SystemMessage('''Always respond to questions with three exclamation marks.''')
# prompt=[HumanMessage("What is the capital of Eswatini?")]
# print(model.invoke(prompt).content)
# human_msg = HumanMessage('What is the capital of France?')
# print(model.invoke([system_msg, human_msg]).content)
# print(model.invoke([human_msg]).content)

from langchain_core.prompts import PromptTemplate

template = PromptTemplate.from_template(
    """Answer the question based on the
    context below. If the question cannot be answered using the information 
    provided, answer with "I don't know".
    Context: {context}
    Question: {question}
    Answer: """
)

res = template.invoke({
    "context": """The most recent advancements in NLP are being driven by Large 
        Language Models (LLMs). These models outperform their smaller 
        counterparts and have become invaluable for developers who are creating 
        applications with NLP capabilities. Developers can tap into these 
        models through Hugging Face's `transformers` library, or by utilizing 
        OpenAI and Cohere's offerings through the `openai` and `cohere` 
        libraries, respectively.""",
    "question": "Which model providers offer LLMs?"
})

# print(res)

from langchain_ollama.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

template = ChatPromptTemplate.from_messages([
    ('system', '''Answer the question based on the context below. If the 
        question cannot be answered using the information provided, answer
        with "I don\'t know".'''),
    ('human', 'Context: {context}'),
    ('human', 'Question: {question}'),
])

model = ChatOllama(model="qwen2.5:1.5b")

prompt = template.invoke({
    "context": """The most recent advancements in NLP are being driven by 
        Large Language Models (LLMs). These models outperform their smaller 
        counterparts and have become invaluable for developers who are creating 
        applications with NLP capabilities. Developers can tap into these 
        models through Hugging Face's `transformers` library, or by utilizing 
        OpenAI and Cohere's offerings through the `openai` and `cohere` 
        libraries, respectively.""",
    "question": "Which model providers offer LLMs?"
})

# print(model.invoke(prompt))

from pydantic import BaseModel #instead of langchain_core.pydantic_v1

class AnswerWithJustification(BaseModel):
    '''An answer to the user's question along with justification for the answer.'''
    answer: str
    '''The answer to the user's question'''
    justification:str
    '''Justification for the answer'''

llm = ChatOllama(model="qwen2.5:1.5b", temperature=0)
structured_llm = llm.with_structured_output(AnswerWithJustification)

# print(structured_llm.invoke("""What weighs more, a pound of bricks or a pound
                        # of feathers"""))

from langchain_core.output_parsers import CommaSeparatedListOutputParser
parser = CommaSeparatedListOutputParser()
items = parser.invoke("apple, banana, cherry")

# print(items)

model = ChatOllama(model="qwen2.5:1.5b")

completion = model.invoke('Hi there!')
# print(completion)

completions = model.batch(['Hi there!', 'Bye!'])
# print(completions)

# for token in model.stream('Bye'):
#     print(token)

from langchain_core.runnables import chain

template = ChatPromptTemplate.from_messages([
    ('system','You are a helpful assistant.'),
    ('human', '{question}'),
])

model = ChatOllama(model="qwen2.5:1.5b")

# @chain
# def chatbot(values):
#     prompt = template.invoke(values)
#     return model.invoke(prompt)

# chatbot.invoke({"question": "Wich model providers offer LLMs?"})

# @chain
# def chatbot(values):
#     prompt = template.invoke(values)
#     for token  in model.stream(prompt):
#         yield token
        
# for part in chatbot.stream({
#     "question": "Which model providers offer LLMs?"
# }):
#     print(part)

@chain
async def chatbot(values):
    prompt = await template.ainvoke(values)
    return await model.ainvoke(prompt)

# await chatbot.ainvoke({"question": "Which model providers offer LLMs?"})

template = ChatPromptTemplate.from_messages([
    ('system','You are a helpful assistant.'),
    ('human','{question}'),
])

model = ChatOllama(model="qwen2.5:1.5b")

chatbot = template | model

# chatbot.invoke({"question":"Which model providers offer LLms?"})

chatbot = template | model
for part in chatbot.stream({
    "question": "Which model providers offer LLMs?"
}):
    print(part)