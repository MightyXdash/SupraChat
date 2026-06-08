from fastapi import FastAPI

app = FastAPI(title="SupraChat AI Backend")


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "python-backend"}
