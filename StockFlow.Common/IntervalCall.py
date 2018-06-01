import datetime

class IntervalCall:
    def __init__(self, seconds):
        self.seconds = seconds
        self.last_time = datetime.datetime.now()

    def maybe_call(self, callback):
        if (datetime.datetime.now() - self.last_time).total_seconds() > self.seconds:
            now = datetime.datetime.now()
            duration = now - self.last_time
            self.last_time = now
            callback(duration)
