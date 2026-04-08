#indexing your data, chapter 2

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