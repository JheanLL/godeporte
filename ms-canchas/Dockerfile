FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ms-canchas/ ./ms-canchas/
EXPOSE 8002
CMD ["uvicorn", "main:app", "--app-dir", "/app/ms-canchas", "--host", "0.0.0.0", "--port", "8002"]
