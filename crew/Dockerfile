FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY data/ data/

RUN mkdir -p /app/data /app/obsidian

EXPOSE 8325

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8325"]
