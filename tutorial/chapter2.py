#indexing your data, chapter 2
import os
os.environ["USER_AGENT"] = "Tsukuba-LLM-Internship-2026/1.0"

from langchain_community.document_loaders import TextLoader, WebBaseLoader, PyPDFLoader

loader = TextLoader("./test.txt")
# print(loader.load())

loader = WebBaseLoader("https://www.hugo-retail.fr/")
# print(loader.load())

loader = PyPDFLoader("./test.pdf")
pages = loader.load()
# print(pages)

from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

loader = TextLoader("./test.txt", encoding="utf-8")
docs = loader.load()
splitter = RecursiveCharacterTextSplitter(
  chunk_size=1000,
  chunk_overlap=200,
)

splitted_docs = splitter.split_documents(docs)
# print(splitted_docs)

PYTHON_CODE = """
def hello_world():
  print("Hello, World!")

# Call the function
hello_world()
"""

python_splitter = RecursiveCharacterTextSplitter.from_language(language=Language.PYTHON, chunk_size=50, chunk_overlap=0)
python_docs = python_splitter.create_documents([PYTHON_CODE])
# print(python_docs)

# resume at page 35

markdown_text = """
# LangChain

⚡ Building applications with LLMs through composability ⚡

## Quick Install
```bash
pip install langchain
```

As an open source project in a rapidly developing field, we are extremely open 
    to contributions.
"""

md_splitter = RecursiveCharacterTextSplitter.from_language(language=Language.MARKDOWN, chunk_size=60, chunk_overlap=0)
md_docs = md_splitter.create_documents([markdown_text],
                                        [{"source":"https://www.langchain.com"}])
# print(md_docs)

from langchain_ollama import OllamaEmbeddings

model = OllamaEmbeddings(model="qwen2.5:1.5b")

embeddings = model.embed_documents([
  "Hi there!",
  "Oh, hello!",
  "What's your name?",
  "My friends call me World",
  "Hello World!"
])
# print(embeddings)

#test with all
loader = TextLoader("./test.txt", encoding="utf-8")
doc = loader.load()

##split the doc
text_splitter = RecursiveCharacterTextSplitter(
  chunk_size=1000,
  chunk_overlap=20,
)
chunks = text_splitter.split_documents(doc)

#generate embeddings
embeddings_model = OllamaEmbeddings(model="qwen2.5:1.5b")
embeddings = embeddings_model.embed_documents(
  [chunk.page_content for chunk in chunks]
)

# docker run --name pgvector-container -e POSTGRES_USER=langchain -e POSTGRES_PASSWORD=langchain -e POSTGRES_DB=langchain -p 6024:5432 -d pgvector/pgvector:pg16

# postgresql+psycopg://langchain:langchain@localhost:6024/langchain

from langchain_postgres.vectorstores import PGVector
from langchain_core.documents import Document
import uuid

#load doc, split it into chunks
raw_documents = TextLoader("./test.txt", encoding="utf-8").load()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000,
                                                chunk_overlap=200)
documents = text_splitter.split_documents(raw_documents)

#embed each chunk, and insert it into the vector store
embeddings_model = OllamaEmbeddings(model="qwen2.5:1.5b")
connection = 'postgresql+psycopg://langchain:langchain@localhost:6024/langchain'
db = PGVector.from_documents(documents,embeddings_model,connection=connection)

ids = [str(uuid.uuid4()),str(uuid.uuid4())]
db.add_documents(
  [
    Document(
      page_content="there are cats in the pond",
      metadata={"location":"pond","topics":"animals"},
    ),
    Document(
      page_content="ducks are also found in the pond",
      metadata={"location": "pond", "topic": "animals"},
    ),
  ],
  ids=ids,
)

db.delete(ids=["1"])

from langchain_core.indexing import index
from langchain_core.indexing import SQLRecordManager
from langchain_postgres.vectorstores import PGVector
from langchain_core.documents import Document
connection = "postgresql+psycopg://langchain:langchain@localhost:6024/langchain"
collection_name = "my_docs"
embeddings_model = OllamaEmbeddings(model="text-embedding-3-small")
namespace = "my_docs_namespace"

vectorstore = PGVector(
    embeddings=embeddings_model,
    collection_name=collection_name,
    connection=connection,
    use_jsonb=True,
)

# record_manager = SQLRecordManager(
#     namespace=namespace,
#     db_url="postgresql+psycopg://langchain:langchain@localhost:6024/langchain",
# )

# Create the schema if it doesn't exist
# record_manager.create_schema()

# Create documents
docs = [
    Document(page_content='there are cats in the pond', metadata={
        "id": 1, "source": "cats.txt"}),
    Document(page_content='ducks are also found in the pond', metadata={
        "id": 2, "source": "ducks.txt"}),
]

# Index the documents
# index_1 = index(
#     docs,
#     record_manager,
#     vectorstore,
#     cleanup="incremental",  # prevent duplicate documents
#     source_id_key="source",  # use the source field as the source_id
# )
# print("Index attempt 1:", index_1)

# second time you attempt to index, it will not add the documents again
# index_2 = index(
#     docs,
#     record_manager,
#     vectorstore,
#     cleanup="incremental",
#     source_id_key="source",
# )
# print("Index attempt 2:", index_2)

# If we mutate a document, the new version will be written and all old 
# versions sharing the same source will be deleted.
# docs[0].page_content = "I just modified this document!"
# index_3 = index(
#     docs,
#     record_manager,
#     vectorstore,
#     cleanup="incremental",
#     source_id_key="source",
# )
# print("Index attempt 3:", index_3)

vectorstore = PGVector(
  embeddings=embeddings_model,
  collection_name=collection_name,
  connection=connection,
  use_jsonb=True,
)

# store = InMemoryStore()
# id_key = "doc_id"

doc_ids=[str(uuid.uuid4()) for _ in chunks]
