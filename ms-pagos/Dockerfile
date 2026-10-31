FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ms-pagos/ ./ms-pagos/
EXPOSE 8003
CMD ["uvicorn", "main:app", "--app-dir", "/app/ms-pagos", "--host", "0.0.0.0", "--port", "8003"]
