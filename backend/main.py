from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import auth, datasets

app = FastAPI(title="DataFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to DataFlow API"}

# Mangum adapter for AWS Lambda
handler = Mangum(app)
