from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from  backend.routes import (
    dashboard, alerts, transactions,
    accounts, pincodes, investigations,
    graph, reports, upload, search
)

app = FastAPI(
    title="TIDE Fraud Detection API",
    version="1.0.0",
    description="Backend API for TIDE Financial Fraud Detection System"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router,      prefix="/api/dashboard",      tags=["Dashboard"])
app.include_router(alerts.router,         prefix="/api/alerts",         tags=["Alerts"])
app.include_router(transactions.router,   prefix="/api/transactions",   tags=["Transactions"])
app.include_router(accounts.router,       prefix="/api/accounts",       tags=["Accounts"])
app.include_router(pincodes.router,       prefix="/api/pincodes",       tags=["Pincodes"])
app.include_router(investigations.router, prefix="/api/investigations", tags=["Investigations"])
app.include_router(graph.router,          prefix="/api/graph",          tags=["Graph Intelligence"])
app.include_router(reports.router,        prefix="/api/reports",        tags=["Reports"])
app.include_router(upload.router,         prefix="/api/upload",         tags=["Upload"])
app.include_router(search.router,         prefix="/api/search",         tags=["Search"])

@app.get("/")
def root():
    return {
        "status": "TIDE API running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    from data.loader import get_data
    df = get_data()
    return {
        "status":      "healthy",
        "total_rows":  len(df),
        "fraud_rows":  int(df['is_fraudulent'].sum()),
        "normal_rows": int((~df['is_fraudulent']).sum()),
    }
