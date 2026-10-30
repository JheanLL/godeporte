FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api-gateway/ ./api-gateway/
COPY demo-visual/ ./demo-visual/
EXPOSE 8080
CMD ["uvicorn", "api-gateway.main:app", "--host", "0.0.0.0", "--port", "8080"]
