FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
COPY brain ./brain
RUN pip install --no-cache-dir ".[ocr,voice]" && useradd -r -u 10001 brain
USER brain
EXPOSE 8100
CMD ["uvicorn", "brain.main:app", "--host", "0.0.0.0", "--port", "8100", "--no-access-log"]
