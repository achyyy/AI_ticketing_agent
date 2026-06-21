import os
import database
import models

# Dispose connections
database.engine.dispose()

try:
    if os.path.exists("tickets.db"):
        os.remove("tickets.db")
        print("tickets.db deleted successfully")
except Exception as e:
    print(f"Failed to delete: {e}")

models.Base.metadata.create_all(bind=database.engine)
print("Database schema recreated successfully.")
