# Sustituir carpeta y puerto por los del servicio asignado.
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ms-ejemplo/ ./ms-ejemplo/
EXPOSE 8006
CMD ["uvicorn", "main:app", "--app-dir", "/app/ms-ejemplo", "--host", "0.0.0.0", "--port", "8006"]
