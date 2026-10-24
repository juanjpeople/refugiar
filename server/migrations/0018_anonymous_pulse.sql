CREATE TABLE IF NOT EXISTS daily_metrics (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);
