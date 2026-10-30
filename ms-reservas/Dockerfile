FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ms-reservas/ ./ms-reservas/
ENV MS_PAGOS_URL="http://ms-pagos:8003"
EXPOSE 8001
CMD ["uvicorn", "ms-reservas.main:app", "--host", "0.0.0.0", "--port", "8001"]
