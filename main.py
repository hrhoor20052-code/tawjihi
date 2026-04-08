import sqlite3
import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "database.sqlite"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # For this transition, we will drop the old schema. 
    # Be careful in production, but for local scratch it's fine.
    cursor.execute('DROP TABLE IF EXISTS students')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seatNumber TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            finalGrade REAL NOT NULL,
            status TEXT NOT NULL,
            details TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class StudentData(BaseModel):
    seatNumber: str
    name: str
    finalGrade: float
    status: str
    details: List[Any]

class TemplateData(BaseModel):
    template: List[Any]

@app.post("/api/settings/template")
def save_template(data: TemplateData):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
    ''', ("template", json.dumps(data.template)))
    conn.commit()
    conn.close()
    return {"message": "Success"}

@app.get("/api/settings/template")
def get_template():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'template'")
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"template": json.loads(row[0])}
    return {"template": []}

@app.post("/api/students")
def save_student(student: StudentData):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM students WHERE seatNumber = ?", (student.seatNumber,))
        existing = cursor.fetchone()
        
        details_json = json.dumps(student.details)
        
        if existing:
            cursor.execute('''
                UPDATE students SET name = ?, finalGrade = ?, status = ?, details = ? WHERE seatNumber = ?
            ''', (student.name, student.finalGrade, student.status, details_json, student.seatNumber))
            student_id = existing[0]
        else:
            cursor.execute('''
                INSERT INTO students (seatNumber, name, finalGrade, status, details) 
                VALUES (?, ?, ?, ?, ?)
            ''', (student.seatNumber, student.name, student.finalGrade, student.status, details_json))
            student_id = cursor.lastrowid
            
        conn.commit()
        return {"id": student_id, "message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/students")
def get_all_students():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT seatNumber, name, finalGrade, status FROM students ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"seatNumber": r[0], "name": r[1], "finalGrade": r[2], "status": r[3]} for r in rows]

@app.get("/api/students/{seat_number}")
def get_student(seat_number: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name, finalGrade, status, details FROM students WHERE seatNumber = ?", (seat_number,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "seatNumber": seat_number, 
            "name": row[0], 
            "finalGrade": row[1],
            "status": row[2],
            "details": json.loads(row[3])
        }
    else:
        raise HTTPException(status_code=404, detail="Student not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3001)
