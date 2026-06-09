#!/usr/bin/env python
"""
RQ Worker entry point.
Run this in a separate terminal:
  python worker.py
"""
import os
from redis import Redis
from rq import Worker, Queue, Connection
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

if __name__ == "__main__":
    redis_conn = Redis.from_url(REDIS_URL)
    queues = [Queue("image_generation", connection=redis_conn)]

    with Connection(redis_conn):
        worker = Worker(queues, connection=redis_conn)
        worker.work(with_scheduler=True)
