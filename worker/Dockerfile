FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir "telethon>=1.36" "httpx>=0.27" "cryptg>=0.4"
COPY . .
CMD ["python", "main.py"]
