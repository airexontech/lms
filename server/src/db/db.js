const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

let dbInstance = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(__dirname, '../../database.sqlite');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  await initSchema(dbInstance);
  await runMigrations(dbInstance);
  await seedData(dbInstance);

  return dbInstance;
}

async function runMigrations(db) {
  const migrations = [
    { table: 'courses',  column: 'image_url',        sql: 'ALTER TABLE courses ADD COLUMN image_url TEXT' },
    { table: 'courses',  column: 'created_at',        sql: "ALTER TABLE courses ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { table: 'modules',  column: 'summary',           sql: 'ALTER TABLE modules ADD COLUMN summary TEXT' },
    { table: 'lessons',  column: 'video_url',         sql: 'ALTER TABLE lessons ADD COLUMN video_url TEXT' },
    { table: 'lessons',  column: 'duration',          sql: 'ALTER TABLE lessons ADD COLUMN duration INTEGER DEFAULT 15' },
    { table: 'playground_submissions', column: 'memory_used_kb', sql: 'ALTER TABLE playground_submissions ADD COLUMN memory_used_kb INTEGER' },
  ];

  for (const m of migrations) {
    try {
      const info = await db.all(`PRAGMA table_info(${m.table})`);
      const exists = info.some(col => col.name === m.column);
      if (!exists) {
        await db.exec(m.sql);
        console.log(`Migration: added column ${m.table}.${m.column}`);
      }
    } catch (err) {
      if (!err.message.includes('no such table')) {
        console.warn(`Migration warning for ${m.table}.${m.column}:`, err.message);
      }
    }
  }
}

async function initSchema(db) {
  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'student')) NOT NULL DEFAULT 'student',
      department TEXT DEFAULT 'Computer Science',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Courses table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      instructor TEXT NOT NULL,
      credits INTEGER DEFAULT 3,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Modules table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      order_index INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Lessons table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      video_url TEXT,
      duration INTEGER DEFAULT 15,
      order_index INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );
  `);

  // Enrollments table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      grade TEXT DEFAULT 'In Progress',
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(student_id, course_id)
    );
  `);

  // Lesson Completions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      UNIQUE(student_id, lesson_id)
    );
  `);

  // Activity Logs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Coding Questions table (per-course practice problems)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS coding_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      difficulty TEXT CHECK(difficulty IN ('Easy','Medium','Hard')) DEFAULT 'Easy',
      starter_code TEXT DEFAULT '',
      solution_code TEXT DEFAULT '',
      test_cases TEXT DEFAULT '[]',
      hints TEXT DEFAULT '',
      order_index INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Quizzes table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      time_limit_minutes INTEGER DEFAULT 30,
      passing_score INTEGER DEFAULT 60,
      order_index INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Quiz questions table (MCQ)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT CHECK(correct_answer IN ('A','B','C','D')) NOT NULL,
      explanation TEXT DEFAULT '',
      order_index INTEGER DEFAULT 1,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
  `);

  // Assignments table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT DEFAULT '',
      due_date TEXT DEFAULT '',
      max_score INTEGER DEFAULT 100,
      order_index INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Playground Submissions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playground_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      language TEXT NOT NULL DEFAULT 'java',
      title TEXT,
      source_code TEXT NOT NULL,
      stdin TEXT DEFAULT '',
      stdout TEXT DEFAULT '',
      stderr TEXT DEFAULT '',
      compile_output TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      exit_code INTEGER,
      execution_time_ms INTEGER,
      memory_used_kb INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

async function seedData(db) {
  // ── Seed users ─────────────────────────────────────────────
  const adminExists = await db.get(`SELECT id FROM users WHERE email = ?`, ['admin@school.edu']);
  if (!adminExists) {
    const hp = await bcrypt.hash('admin123', 10);
    await db.run(`INSERT INTO users (name,email,password,role,department) VALUES (?,?,?,?,?)`,
      ['System Administrator','admin@school.edu',hp,'admin','Administration']);
    console.log('Seeded admin@school.edu / admin123');
  }

  const studentExists = await db.get(`SELECT id FROM users WHERE email = ?`, ['student@school.edu']);
  let studentId = studentExists?.id;
  if (!studentExists) {
    const hp = await bcrypt.hash('student123', 10);
    const r = await db.run(`INSERT INTO users (name,email,password,role,department) VALUES (?,?,?,?,?)`,
      ['Alex Johnson','student@school.edu',hp,'student','Computer Science']);
    studentId = r.lastID;
    console.log('Seeded student@school.edu / student123');
  }

  // ── Seed courses only if table is empty ────────────────────
  const { count } = await db.get(`SELECT COUNT(*) as count FROM courses`);
  if (count > 0) return;

  console.log('Seeding Java course content…');

  // ──────────────────────────────────────────────────────────
  // COURSE 1: Java Foundation
  // ──────────────────────────────────────────────────────────
  const jf = await db.run(`INSERT INTO courses (code,title,description,instructor,credits,image_url) VALUES (?,?,?,?,?,?)`, [
    'JAVA101',
    'Java Foundation',
    'Start from scratch: install Java, understand how it works, and write your first programs. Covers syntax, data types, operators, and control flow.',
    'Prof. Anita Sharma',
    4,
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80'
  ]);
  const jfId = jf.lastID;

  // Module 1 – Getting Started
  const jfM1 = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
    [jfId, 'Module 1: Getting Started with Java', 'JDK setup, JVM/JRE concepts, first Hello World program.', 1]);
  const jfM1id = jfM1.lastID;
  const jfM1Lessons = [
    ['Introduction to Java & History', `Java was developed by James Gosling at Sun Microsystems in 1995. It follows the WORA principle — Write Once, Run Anywhere — because compiled Java bytecode runs on any platform with a JVM.\n\nKey facts:\n• Object-oriented, platform-independent, robust\n• Used in Android, enterprise systems, big data\n• Strongly typed, garbage-collected\n• JDK = Java Development Kit (compiler + tools)\n• JRE = Java Runtime Environment (JVM + libraries)\n• JVM = Java Virtual Machine (runs bytecode)`, 20],
    ['Installing JDK & Setting up IntelliJ / VS Code', `Step-by-step JDK installation:\n\n1. Download JDK 17+ from https://adoptium.net\n2. Set JAVA_HOME environment variable:\n   Windows: System Properties → Environment Variables\n   Linux/Mac: export JAVA_HOME=/path/to/jdk\n3. Add %JAVA_HOME%\\bin to PATH\n4. Verify: open terminal → java -version\n\nIDE Setup:\n• IntelliJ IDEA (recommended): File → New Project → Java\n• VS Code: Install "Extension Pack for Java"\n• Eclipse: File → New → Java Project\n\nFirst compile & run:\n  javac Hello.java   → creates Hello.class\n  java Hello         → runs the program`, 25],
    ['Your First Java Program – Hello World', `public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n\nBreakdown:\n• public class Hello  — class name must match filename\n• public static void main(String[] args)  — entry point\n• System.out.println()  — prints to console with newline\n• System.out.print()    — prints without newline\n• System.out.printf()   — formatted print\n\nEvery Java program must have:\n  1. At least one class\n  2. A main method with exact signature\n  3. Statements ending with semicolons`, 20],
    ['Understanding JVM, JRE, and JDK', `JVM (Java Virtual Machine):\n• Interprets bytecode (.class files)\n• Handles memory management (heap, stack)\n• Provides garbage collection\n• Platform-specific — different JVM per OS\n\nJRE (Java Runtime Environment):\n• JVM + standard class libraries\n• Needed to RUN Java programs\n\nJDK (Java Development Kit):\n• JRE + compiler (javac) + tools (jar, javadoc)\n• Needed to DEVELOP Java programs\n\nCompilation flow:\n  Source (.java) → javac → Bytecode (.class) → JVM → Output\n\nClass loading:\n  Bootstrap → Extension → Application classloader`, 25],
  ];
  for (let i = 0; i < jfM1Lessons.length; i++) {
    await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
      [jfM1id, jfM1Lessons[i][0], jfM1Lessons[i][1], jfM1Lessons[i][2], i + 1]);
  }

  // Module 2 – Variables & Data Types
  const jfM2 = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
    [jfId, 'Module 2: Variables & Data Types', 'Primitive types, type casting, String, literals and constants.', 2]);
  const jfM2id = jfM2.lastID;
  const jfM2Lessons = [
    ['Primitive Data Types', `Java has 8 primitive data types:\n\n| Type    | Size    | Range                          | Default |\n|---------|---------|-------------------------------|------|\n| byte    | 8-bit   | -128 to 127                   | 0    |\n| short   | 16-bit  | -32,768 to 32,767             | 0    |\n| int     | 32-bit  | -2^31 to 2^31-1               | 0    |\n| long    | 64-bit  | -2^63 to 2^63-1               | 0L   |\n| float   | 32-bit  | ±3.4e38 (6-7 decimal digits)  | 0.0f |\n| double  | 64-bit  | ±1.7e308 (15 decimal digits)  | 0.0d |\n| char    | 16-bit  | Unicode 0 to 65535            | '\\u0000'|\n| boolean | 1-bit   | true / false                  | false|\n\nExamples:\n  int age = 25;\n  double price = 99.99;\n  char grade = 'A';\n  boolean isActive = true;\n  long population = 7_900_000_000L;`, 30],
    ['Variables – Declaration, Initialization, Scope', `Variable types:\n\n1. Local variable — declared inside method, no default value\n   void show() {\n       int x = 10;  // must initialize before use\n   }\n\n2. Instance variable — declared in class, has default value\n   class Student {\n       String name;  // default: null\n       int age;      // default: 0\n   }\n\n3. Static/Class variable — shared across all instances\n   static int count = 0;\n\nNaming rules:\n  • Start with letter, $ or _\n  • Case-sensitive: age ≠ Age\n  • No keywords (int, class, etc.)\n  • camelCase convention: studentName, totalMarks\n\nConstants with final:\n  final double PI = 3.14159;\n  final int MAX_SIZE = 100;`, 25],
    ['Type Casting & Type Conversion', `Widening (automatic — no data loss):\n  int i = 100;\n  long l = i;      // int → long\n  double d = i;    // int → double\n  byte → short → int → long → float → double\n\nNarrowing (manual — may lose data):\n  double d = 9.99;\n  int i = (int) d;   // i = 9  (decimal part lost)\n  long l = 1234567890123L;\n  int x = (int) l;   // overflow possible!\n\nString conversions:\n  int n = 42;\n  String s = String.valueOf(n);  // "42"\n  String s2 = Integer.toString(n); // "42"\n  String s3 = n + "";             // "42"\n\n  String input = "123";\n  int parsed = Integer.parseInt(input);    // 123\n  double d2 = Double.parseDouble("3.14");  // 3.14`, 25],
    ['Strings in Java', `String is a class (not primitive) — immutable:\n  String name = "Alice";\n  String name2 = new String("Alice"); // rare\n\nCommon String methods:\n  name.length()           → 5\n  name.charAt(0)          → 'A'\n  name.toLowerCase()      → "alice"\n  name.toUpperCase()      → "ALICE"\n  name.trim()             → removes leading/trailing spaces\n  name.replace("A","@")   → "@lice"\n  name.contains("lic")    → true\n  name.startsWith("Al")   → true\n  name.endsWith("ce")     → true\n  name.indexOf("l")       → 1\n  name.substring(1,4)     → "lic"\n  name.split(",")         → array of strings\n  name.equals("Alice")    → true  (use this!)\n  name == "Alice"         → unreliable (compares refs)\n\nStringBuilder (mutable, efficient):\n  StringBuilder sb = new StringBuilder();\n  sb.append("Hello");\n  sb.append(" World");\n  System.out.println(sb.toString()); // Hello World`, 30],
  ];
  for (let i = 0; i < jfM2Lessons.length; i++) {
    await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
      [jfM2id, jfM2Lessons[i][0], jfM2Lessons[i][1], jfM2Lessons[i][2], i + 1]);
  }

  // Module 3 – Operators
  const jfM3 = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
    [jfId, 'Module 3: Operators', 'Arithmetic, relational, logical, bitwise, assignment and ternary operators.', 3]);
  const jfM3id = jfM3.lastID;
  const jfM3Lessons = [
    ['Arithmetic & Assignment Operators', `Arithmetic operators:\n  +  addition        5 + 3 = 8\n  -  subtraction     5 - 3 = 2\n  *  multiplication  5 * 3 = 15\n  /  division        10 / 3 = 3  (integer division!)\n  %  modulus         10 % 3 = 1\n\nInteger vs float division:\n  int a = 10 / 3;      // 3 (no decimal)\n  double b = 10.0 / 3; // 3.333...\n\nAssignment operators:\n  =    x = 5\n  +=   x += 3  →  x = x + 3\n  -=   x -= 2  →  x = x - 2\n  *=   x *= 4  →  x = x * 4\n  /=   x /= 2  →  x = x / 2\n  %=   x %= 3  →  x = x % 3\n\nIncrement / Decrement:\n  int x = 5;\n  x++;   // post-increment: use x, then add 1\n  ++x;   // pre-increment: add 1, then use x\n  x--;   x = x - 1\n  --x;   subtract first`, 25],
    ['Relational & Logical Operators', `Relational operators (return boolean):\n  ==   equals             5 == 5  → true\n  !=   not equals         5 != 3  → true\n  >    greater than       5 > 3   → true\n  <    less than          5 < 3   → false\n  >=   greater or equal   5 >= 5  → true\n  <=   less or equal      3 <= 5  → true\n\nLogical operators:\n  &&   AND  — both must be true\n       (5>2 && 3>1)  → true\n       (5>2 && 3>5)  → false\n\n  ||   OR   — at least one must be true\n       (5>2 || 3>5)  → true\n       (1>2 || 3>5)  → false\n\n  !    NOT  — reverses boolean\n       !(5>2)  → false\n       !(1>2)  → true\n\nShort-circuit evaluation:\n  &&: if left is false, right is not evaluated\n  ||: if left is true, right is not evaluated\n\n  int x = 0;\n  if (x != 0 && 10/x > 1) { } // safe — no division by zero`, 25],
    ['Bitwise, Ternary & instanceof Operators', `Ternary operator (compact if-else):\n  condition ? valueIfTrue : valueIfFalse\n\n  int age = 20;\n  String result = (age >= 18) ? "Adult" : "Minor";\n  System.out.println(result); // Adult\n\n  int max = (a > b) ? a : b;\n\nBitwise operators (work on bits):\n  &    AND     1010 & 1100 = 1000\n  |    OR      1010 | 1100 = 1110\n  ^    XOR     1010 ^ 1100 = 0110\n  ~    NOT     ~5 = -6\n  <<   left shift    5 << 1 = 10  (multiply by 2)\n  >>   right shift   10 >> 1 = 5  (divide by 2)\n  >>>  unsigned right shift\n\ninstanceof operator:\n  String s = "Hello";\n  System.out.println(s instanceof String); // true\n  System.out.println(s instanceof Object); // true\n  Object obj = null;\n  System.out.println(obj instanceof String); // false`, 25],
  ];
  for (let i = 0; i < jfM3Lessons.length; i++) {
    await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
      [jfM3id, jfM3Lessons[i][0], jfM3Lessons[i][1], jfM3Lessons[i][2], i + 1]);
  }

  // Module 4 – Control Flow
  const jfM4 = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
    [jfId, 'Module 4: Control Flow', 'if/else, switch, for, while, do-while, break, continue.', 4]);
  const jfM4id = jfM4.lastID;
  const jfM4Lessons = [
    ['if, else if, else Statements', `Syntax:\n  if (condition) {\n      // executes if condition is true\n  } else if (anotherCondition) {\n      // executes if previous false and this true\n  } else {\n      // executes if all above are false\n  }\n\nExample:\n  int marks = 75;\n  if (marks >= 90) {\n      System.out.println("Grade: A");\n  } else if (marks >= 75) {\n      System.out.println("Grade: B");\n  } else if (marks >= 60) {\n      System.out.println("Grade: C");\n  } else {\n      System.out.println("Grade: F");\n  }\n\nNested if:\n  if (age >= 18) {\n      if (hasLicense) {\n          System.out.println("Can drive");\n      }\n  }`, 20],
    ['switch Statement', `switch compares a variable against multiple values:\n\n  int day = 3;\n  switch (day) {\n      case 1: System.out.println("Monday"); break;\n      case 2: System.out.println("Tuesday"); break;\n      case 3: System.out.println("Wednesday"); break;\n      case 4: System.out.println("Thursday"); break;\n      case 5: System.out.println("Friday"); break;\n      default: System.out.println("Weekend");\n  }\n\nWithout break → fall-through (executes next cases too)\n\nswitch with String (Java 7+):\n  String color = "red";\n  switch (color) {\n      case "red":   System.out.println("Stop"); break;\n      case "green": System.out.println("Go"); break;\n      default:      System.out.println("Caution");\n  }\n\nSwitch expression (Java 14+):\n  String result = switch(day) {\n      case 1 -> "Monday";\n      case 2 -> "Tuesday";\n      default -> "Other";\n  };`, 25],
    ['for, while, do-while Loops', `for loop (when count is known):\n  for (init; condition; update) { }\n\n  for (int i = 0; i < 5; i++) {\n      System.out.println("i = " + i);\n  }\n\nEnhanced for loop (for-each):\n  int[] nums = {10, 20, 30, 40};\n  for (int n : nums) {\n      System.out.println(n);\n  }\n\nwhile loop (condition checked first):\n  int i = 0;\n  while (i < 5) {\n      System.out.println(i);\n      i++;\n  }\n\ndo-while (runs at least once):\n  int i = 0;\n  do {\n      System.out.println(i);\n      i++;\n  } while (i < 5);\n\nbreak — exits the loop immediately\ncontinue — skips current iteration\n\n  for (int i = 0; i < 10; i++) {\n      if (i == 5) break;     // stops at 5\n      if (i % 2 == 0) continue; // skips even\n      System.out.println(i); // prints 1,3\n  }`, 30],
  ];
  for (let i = 0; i < jfM4Lessons.length; i++) {
    await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
      [jfM4id, jfM4Lessons[i][0], jfM4Lessons[i][1], jfM4Lessons[i][2], i + 1]);
  }

  // Seed coding questions for Java Foundation
  const jfQuestions = [
    ['Print Sum of Two Numbers', 'Write a Java program to read two integers from the user and print their sum.', 'Easy',
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        // Write your code here\n    }\n}`,
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        System.out.println(a + b);\n    }\n}`,
     '[{"input":"3 5","expected":"8"},{"input":"10 20","expected":"30"},{"input":"-4 4","expected":"0"}]',
     'Use Scanner to read input. Add two integers and print.'],
    ['Check Even or Odd', 'Write a program that reads an integer and prints "Even" if it is divisible by 2, otherwise prints "Odd".', 'Easy',
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Write your code here\n    }\n}`,
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        System.out.println(n % 2 == 0 ? "Even" : "Odd");\n    }\n}`,
     '[{"input":"4","expected":"Even"},{"input":"7","expected":"Odd"},{"input":"0","expected":"Even"}]',
     'Use the modulus operator (%). If remainder is 0 → Even.'],
    ['FizzBuzz', 'Print numbers 1 to N. For multiples of 3 print "Fizz", multiples of 5 print "Buzz", multiples of both print "FizzBuzz", otherwise print the number. Read N from input.', 'Easy',
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Write your code here\n    }\n}`,
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        for (int i = 1; i <= n; i++) {\n            if (i % 15 == 0) System.out.println("FizzBuzz");\n            else if (i % 3 == 0) System.out.println("Fizz");\n            else if (i % 5 == 0) System.out.println("Buzz");\n            else System.out.println(i);\n        }\n    }\n}`,
     '[{"input":"15","expected":"1\\n2\\nFizz\\n4\\nBuzz\\nFizz\\n7\\n8\\nFizz\\nBuzz\\n11\\nFizz\\n13\\n14\\nFizzBuzz"}]',
     'Check divisibility by 15 first (both 3 and 5), then 3, then 5.'],
    ['Reverse a Number', 'Read an integer and print its digits reversed. E.g. 1234 → 4321.', 'Medium',
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Write your code here\n    }\n}`,
     `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int rev = 0;\n        while (n != 0) {\n            rev = rev * 10 + n % 10;\n            n /= 10;\n        }\n        System.out.println(rev);\n    }\n}`,
     '[{"input":"1234","expected":"4321"},{"input":"100","expected":"1"},{"input":"9","expected":"9"}]',
     'Use modulus to get last digit, build reversed number by multiplying accumulated result by 10.'],
  ];
  for (let i = 0; i < jfQuestions.length; i++) {
    const q = jfQuestions[i];
    await db.run(`INSERT INTO coding_questions (course_id,title,description,difficulty,starter_code,solution_code,test_cases,hints,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [jfId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], i + 1]);
  }

  // Seed quiz for Java Foundation
  const jfQuiz = await db.run(`INSERT INTO quizzes (course_id,title,description,time_limit_minutes,passing_score,order_index) VALUES (?,?,?,?,?,?)`,
    [jfId, 'Java Basics Quiz', 'Test your understanding of Java primitives, operators and control flow.', 20, 60, 1]);
  const jfQuizId = jfQuiz.lastID;
  const jfMcq = [
    ['What is the default value of an int variable in Java?', '0', 'null', '-1', 'undefined', 'A', 'Java initializes instance int variables to 0 by default.'],
    ['Which operator is used for integer division in Java?', '/', '//', 'div', '%', 'A', 'The / operator performs integer division when both operands are integers.'],
    ['Which of these is NOT a primitive data type in Java?', 'String', 'int', 'double', 'boolean', 'A', 'String is a class (reference type), not a primitive.'],
    ['What does System.out.println() do?', 'Prints to console with newline', 'Prints to console without newline', 'Reads from console', 'Exits the program', 'A', 'println stands for print line — adds \\n after output.'],
    ['What will 10 % 3 evaluate to?', '1', '3', '0', '2', 'A', '10 divided by 3 = 3 remainder 1. Modulus gives the remainder.'],
    ['Which loop is guaranteed to execute at least once?', 'do-while', 'for', 'while', 'for-each', 'A', 'do-while checks the condition AFTER the first execution.'],
  ];
  for (let i = 0; i < jfMcq.length; i++) {
    const q = jfMcq[i];
    await db.run(`INSERT INTO quiz_questions (quiz_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [jfQuizId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], i + 1]);
  }

  // Seed assignment for Java Foundation
  await db.run(`INSERT INTO assignments (course_id,title,description,instructions,due_date,max_score,order_index) VALUES (?,?,?,?,?,?,?)`, [
    jfId,
    'Assignment 1: Number Cruncher Program',
    'Build a console program that reads 5 integers and outputs: sum, average, max, min, and whether the count of even numbers is greater than odd numbers.',
    `Requirements:\n1. Read exactly 5 integers from stdin (space or newline separated)\n2. Print: Sum: <value>\n3. Print: Average: <value> (rounded to 2 decimal places)\n4. Print: Max: <value>\n5. Print: Min: <value>\n6. Print: Even count: <n>, Odd count: <n>\n\nExample input:  3 7 2 8 5\nExpected output:\n  Sum: 25\n  Average: 5.00\n  Max: 8\n  Min: 2\n  Even count: 2, Odd count: 3\n\nSubmission: Paste your complete Java code in the text area below.`,
    '2026-09-15',
    100,
    1
  ]);

  // ──────────────────────────────────────────────────────────
  // COURSE 2: Core Java
  // ──────────────────────────────────────────────────────────
  const cj = await db.run(`INSERT INTO courses (code,title,description,instructor,credits,image_url) VALUES (?,?,?,?,?,?)`, [
    'JAVA201',
    'Core Java',
    'Deep dive into OOP: classes, objects, inheritance, polymorphism, interfaces, exception handling, collections, and generics.',
    'Dr. Rajesh Kumar',
    4,
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80'
  ]);
  const cjId = cj.lastID;

  const cjModules = [
    ['Module 1: Classes & Objects', 'Defining classes, creating objects, constructors, this keyword.', [
      ['Classes and Objects', `A class is a blueprint; an object is an instance:\n\n  class Student {\n      // Fields (instance variables)\n      String name;\n      int age;\n      double gpa;\n\n      // Method\n      void display() {\n          System.out.println(name + " | Age: " + age + " | GPA: " + gpa);\n      }\n  }\n\n  // Creating objects\n  Student s1 = new Student();\n  s1.name = "Alice";\n  s1.age = 20;\n  s1.gpa = 3.8;\n  s1.display();\n\n  Student s2 = new Student();\n  s2.name = "Bob";\n\nMemory:\n  • Objects live in heap memory\n  • Variables hold references (addresses)\n  • s1 == s2 compares references, not content`, 30],
      ['Constructors', `Constructor initializes an object when created with new:\n\n  class Student {\n      String name;\n      int age;\n\n      // Default constructor (no-arg)\n      Student() {\n          name = "Unknown";\n          age = 0;\n      }\n\n      // Parameterized constructor\n      Student(String n, int a) {\n          this.name = n;   // this refers to current object\n          this.age = a;\n      }\n\n      // Copy constructor\n      Student(Student s) {\n          this.name = s.name;\n          this.age = s.age;\n      }\n  }\n\n  Student s1 = new Student("Alice", 20);\n  Student s2 = new Student(s1); // copy\n\nConstructor overloading — multiple constructors with different params\nthis() — call another constructor from within a constructor`, 30],
      ['Encapsulation & Getters/Setters', `Encapsulation: hide data, expose via methods:\n\n  class BankAccount {\n      private double balance;  // private — hidden\n      private String owner;\n\n      public BankAccount(String owner, double initial) {\n          this.owner = owner;\n          this.balance = initial;\n      }\n\n      // Getter\n      public double getBalance() {\n          return balance;\n      }\n\n      // Setter with validation\n      public void deposit(double amount) {\n          if (amount > 0) balance += amount;\n      }\n\n      public boolean withdraw(double amount) {\n          if (amount > 0 && amount <= balance) {\n              balance -= amount;\n              return true;\n          }\n          return false;\n      }\n  }\n\n  BankAccount acc = new BankAccount("Alice", 1000);\n  acc.deposit(500);\n  System.out.println(acc.getBalance()); // 1500`, 30],
    ]],
    ['Module 2: Inheritance & Polymorphism', 'extends, super, method overriding, abstract classes.', [
      ['Inheritance', `Inheritance allows a class to inherit fields/methods from a parent:\n\n  class Animal {\n      String name;\n\n      Animal(String name) { this.name = name; }\n\n      void eat() { System.out.println(name + " eats."); }\n      void sleep() { System.out.println(name + " sleeps."); }\n  }\n\n  class Dog extends Animal {\n      String breed;\n\n      Dog(String name, String breed) {\n          super(name);  // calls parent constructor\n          this.breed = breed;\n      }\n\n      void bark() { System.out.println(name + " barks!"); }\n  }\n\n  Dog d = new Dog("Rex", "Labrador");\n  d.eat();   // inherited\n  d.bark();  // own method\n\nJava supports single inheritance (one parent class)\nUse super.method() to call parent method\nAll classes implicitly extend Object`, 30],
      ['Method Overriding & Polymorphism', `Overriding: child redefines parent's method\n\n  class Shape {\n      double area() { return 0; }\n      void describe() {\n          System.out.println("Area = " + area());\n      }\n  }\n\n  class Circle extends Shape {\n      double radius;\n      Circle(double r) { this.radius = r; }\n\n      @Override\n      double area() { return Math.PI * radius * radius; }\n  }\n\n  class Rectangle extends Shape {\n      double w, h;\n      Rectangle(double w, double h) { this.w=w; this.h=h; }\n\n      @Override\n      double area() { return w * h; }\n  }\n\n  // Polymorphism — same reference, different behavior\n  Shape s1 = new Circle(5);\n  Shape s2 = new Rectangle(4, 6);\n  s1.describe(); // Area = 78.54\n  s2.describe(); // Area = 24.0\n\n  // Array of different shapes\n  Shape[] shapes = { new Circle(3), new Rectangle(2,5) };\n  for (Shape s : shapes) s.describe();`, 35],
      ['Abstract Classes & Interfaces', `Abstract class — cannot be instantiated, may have abstract methods:\n\n  abstract class Vehicle {\n      String brand;\n      abstract void start();      // must override\n      void stop() { System.out.println("Stopped"); } // can override\n  }\n\n  class Car extends Vehicle {\n      @Override\n      void start() { System.out.println("Car starts with key"); }\n  }\n\nInterface — 100% abstract (Java 7), can have default methods (Java 8+):\n\n  interface Printable {\n      void print();  // implicitly public abstract\n  }\n\n  interface Saveable {\n      void save();\n      default void backup() { System.out.println("Backing up..."); }\n  }\n\n  class Document implements Printable, Saveable {\n      public void print() { System.out.println("Printing..."); }\n      public void save() { System.out.println("Saving..."); }\n  }\n\nClass can implement multiple interfaces but extend only one class`, 35],
    ]],
    ['Module 3: Exception Handling', 'try-catch-finally, custom exceptions, throws, checked vs unchecked.', [
      ['try-catch-finally', `Exceptions disrupt normal program flow. Handle them:\n\n  try {\n      int result = 10 / 0;  // ArithmeticException\n  } catch (ArithmeticException e) {\n      System.out.println("Error: " + e.getMessage());\n  } finally {\n      System.out.println("This always runs");\n  }\n\nMultiple catch blocks:\n  try {\n      String s = null;\n      int[] arr = new int[3];\n      s.length();         // NullPointerException\n      arr[10] = 5;        // ArrayIndexOutOfBoundsException\n  } catch (NullPointerException e) {\n      System.out.println("Null pointer: " + e.getMessage());\n  } catch (ArrayIndexOutOfBoundsException e) {\n      System.out.println("Array out of bounds");\n  } catch (Exception e) {\n      System.out.println("General: " + e.getMessage());\n  } finally {\n      System.out.println("Cleanup done");\n  }\n\nfinally always executes (resource cleanup, closing files, etc.)\ntry-with-resources (Java 7+): auto-closes resources`, 35],
      ['Custom Exceptions & throws/throw', `throw — manually throw an exception\nthrows — declare that a method might throw exceptions\n\n  class InsufficientFundsException extends Exception {\n      private double amount;\n\n      InsufficientFundsException(double amount) {\n          super("Insufficient funds. Needed: " + amount);\n          this.amount = amount;\n      }\n\n      double getAmount() { return amount; }\n  }\n\n  class BankAccount {\n      private double balance = 500;\n\n      void withdraw(double amount) throws InsufficientFundsException {\n          if (amount > balance) {\n              throw new InsufficientFundsException(amount);\n          }\n          balance -= amount;\n      }\n  }\n\n  // Using it:\n  BankAccount acc = new BankAccount();\n  try {\n      acc.withdraw(1000);\n  } catch (InsufficientFundsException e) {\n      System.out.println(e.getMessage());\n  }\n\nChecked exceptions: must be caught or declared (IOException, SQLException)\nUnchecked exceptions: extend RuntimeException (NullPointer, etc.)`, 30],
    ]],
    ['Module 4: Collections & Generics', 'ArrayList, HashMap, HashSet, LinkedList, generics.', [
      ['ArrayList & LinkedList', `import java.util.*;\n\nArrayList — dynamic array, index-based access O(1):\n  ArrayList<String> list = new ArrayList<>();\n  list.add("Alice");\n  list.add("Bob");\n  list.add(1, "Charlie"); // insert at index\n  list.get(0);            // "Alice"\n  list.remove("Bob");     // remove by value\n  list.remove(0);         // remove by index\n  list.size();            // count\n  list.contains("Alice"); // true\n  Collections.sort(list); // sort alphabetically\n\n  // Iterate\n  for (String s : list) System.out.println(s);\n  list.forEach(System.out::println); // lambda\n\nLinkedList — doubly linked, fast insert/delete:\n  LinkedList<Integer> ll = new LinkedList<>();\n  ll.addFirst(1);\n  ll.addLast(3);\n  ll.add(1, 2);\n  ll.removeFirst();\n  ll.peekFirst(); // view without removing\n\nUse ArrayList for frequent random access\nUse LinkedList for frequent insertions/deletions at ends`, 35],
      ['HashMap & HashSet', `HashMap<K,V> — key-value pairs, O(1) get/put:\n  HashMap<String, Integer> scores = new HashMap<>();\n  scores.put("Alice", 95);\n  scores.put("Bob", 87);\n  scores.put("Alice", 99); // overwrites previous\n  scores.get("Bob");       // 87\n  scores.containsKey("Charlie"); // false\n  scores.remove("Bob");\n  scores.size();\n\n  // Iterate entries\n  for (Map.Entry<String,Integer> e : scores.entrySet()) {\n      System.out.println(e.getKey() + " → " + e.getValue());\n  }\n\nHashSet<E> — unique elements, no duplicates, no order:\n  HashSet<String> set = new HashSet<>();\n  set.add("apple");\n  set.add("banana");\n  set.add("apple"); // ignored — already exists\n  set.size();       // 2\n  set.contains("banana"); // true\n\nLinkedHashMap — maintains insertion order\nTreeMap — sorted by key\nTreeSet — sorted set`, 35],
      ['Generics', `Generics enable type-safe collections and methods:\n\n  // Generic class\n  class Box<T> {\n      private T content;\n      Box(T content) { this.content = content; }\n      T get() { return content; }\n  }\n\n  Box<String> sBox = new Box<>("Hello");\n  Box<Integer> iBox = new Box<>(42);\n  String s = sBox.get(); // no cast needed\n\n  // Generic method\n  static <T> void swap(T[] arr, int i, int j) {\n      T temp = arr[i];\n      arr[i] = arr[j];\n      arr[j] = temp;\n  }\n\n  // Bounded type parameters\n  static <T extends Comparable<T>> T max(T a, T b) {\n      return a.compareTo(b) > 0 ? a : b;\n  }\n  System.out.println(max(10, 20)); // 20\n  System.out.println(max("Alice","Bob")); // Bob\n\n  // Wildcard\n  void printList(List<?> list) {\n      for (Object o : list) System.out.println(o);\n  }`, 35],
    ]],
  ];

  for (let mi = 0; mi < cjModules.length; mi++) {
    const [modTitle, modSummary, lessons] = cjModules[mi];
    const mod = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
      [cjId, modTitle, modSummary, mi + 1]);
    for (let li = 0; li < lessons.length; li++) {
      await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
        [mod.lastID, lessons[li][0], lessons[li][1], lessons[li][2], li + 1]);
    }
  }

  // Core Java quiz
  const cjQuiz = await db.run(`INSERT INTO quizzes (course_id,title,description,time_limit_minutes,passing_score,order_index) VALUES (?,?,?,?,?,?)`,
    [cjId, 'OOP Concepts Quiz', 'Test your knowledge of classes, inheritance, and exceptions.', 25, 60, 1]);
  const cjQuizId = cjQuiz.lastID;
  const cjMcq = [
    ['Which keyword is used to inherit a class in Java?', 'extends', 'implements', 'inherits', 'super', 'A', 'extends keyword establishes inheritance between classes.'],
    ['Which concept hides internal implementation details?', 'Encapsulation', 'Polymorphism', 'Abstraction', 'Inheritance', 'A', 'Encapsulation wraps data and methods, hiding internal state.'],
    ['What is the parent class of all Java classes?', 'Object', 'Class', 'Super', 'Base', 'A', 'java.lang.Object is the root of the class hierarchy.'],
    ['Which collection allows duplicate elements?', 'ArrayList', 'HashSet', 'TreeSet', 'LinkedHashSet', 'A', 'ArrayList allows duplicates; Set implementations do not.'],
    ['What exception is thrown for division by zero?', 'ArithmeticException', 'NullPointerException', 'NumberFormatException', 'RuntimeException', 'A', 'Integer division by zero throws ArithmeticException.'],
  ];
  for (let i = 0; i < cjMcq.length; i++) {
    const q = cjMcq[i];
    await db.run(`INSERT INTO quiz_questions (quiz_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [cjQuizId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], i + 1]);
  }

  // Core Java assignment
  await db.run(`INSERT INTO assignments (course_id,title,description,instructions,due_date,max_score,order_index) VALUES (?,?,?,?,?,?,?)`, [
    cjId, 'Assignment: Bank Account System',
    'Design a console-based bank account system using OOP principles.',
    `Create a Java program with:\n1. A BankAccount class with private balance, owner name, and account number\n2. Methods: deposit(amount), withdraw(amount) with validation, getBalance(), printStatement()\n3. A SavingsAccount subclass that earns 5% interest via addInterest() method\n4. Custom exception: InsufficientFundsException\n5. A Main class demonstrating: create accounts, deposit, withdraw, handle exceptions\n\nMinimum test cases to demonstrate:\n  - Create a savings account with Rs.10,000\n  - Deposit Rs.5,000\n  - Try to withdraw Rs.20,000 → catch exception\n  - Add interest\n  - Print final balance`,
    '2026-09-30', 100, 1
  ]);

  // ──────────────────────────────────────────────────────────
  // COURSE 3: MySQL
  // ──────────────────────────────────────────────────────────
  const mysql = await db.run(`INSERT INTO courses (code,title,description,instructor,credits,image_url) VALUES (?,?,?,?,?,?)`, [
    'DB301',
    'MySQL Database',
    'Learn relational database design, SQL queries, joins, indexes, stored procedures, and normalization using MySQL.',
    'Dr. Priya Nair',
    3,
    'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=600&auto=format&fit=crop&q=80'
  ]);
  const mysqlId = mysql.lastID;

  const mysqlModules = [
    ['Module 1: SQL Basics & DDL', 'CREATE, ALTER, DROP, data types, constraints.', [
      ['Introduction to Databases & MySQL', `A database organizes data for efficient storage and retrieval.\n\nTypes:\n• Relational (MySQL, PostgreSQL, Oracle) — tables with rows/columns\n• NoSQL (MongoDB, Redis) — flexible schema\n\nMySQL setup:\n  Install MySQL Server + MySQL Workbench\n  Default port: 3306\n  Connect: mysql -u root -p\n\nBasic commands:\n  SHOW DATABASES;\n  CREATE DATABASE school;\n  USE school;\n  SHOW TABLES;\n  DESCRIBE students;\n  EXIT;\n\nSQL categories:\n  DDL — Data Definition Language (CREATE, ALTER, DROP)\n  DML — Data Manipulation Language (INSERT, UPDATE, DELETE)\n  DQL — Data Query Language (SELECT)\n  DCL — Data Control Language (GRANT, REVOKE)\n  TCL — Transaction Control (COMMIT, ROLLBACK)`, 25],
      ['CREATE TABLE, Data Types & Constraints', `CREATE TABLE students (\n    id        INT PRIMARY KEY AUTO_INCREMENT,\n    name      VARCHAR(100) NOT NULL,\n    email     VARCHAR(150) UNIQUE NOT NULL,\n    age       INT CHECK(age >= 16 AND age <= 100),\n    dept      VARCHAR(50) DEFAULT 'General',\n    gpa       DECIMAL(3,2),\n    enrolled  DATE,\n    created   TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\nCommon data types:\n  INT, BIGINT, SMALLINT       — integers\n  DECIMAL(p,s), FLOAT, DOUBLE — numbers\n  VARCHAR(n)                  — variable string (max n)\n  CHAR(n)                     — fixed-length string\n  TEXT, LONGTEXT              — large text\n  DATE (YYYY-MM-DD)\n  DATETIME, TIMESTAMP\n  BOOLEAN / TINYINT(1)\n  ENUM('val1','val2',...)\n\nConstraints:\n  PRIMARY KEY  — unique identifier\n  FOREIGN KEY  — reference another table\n  NOT NULL     — must have value\n  UNIQUE       — no duplicates\n  DEFAULT      — fallback value\n  CHECK        — value validation\n  AUTO_INCREMENT — auto numbers`, 35],
      ['ALTER TABLE & DROP', `ALTER TABLE — modify existing table structure:\n\n  -- Add column\n  ALTER TABLE students ADD COLUMN phone VARCHAR(15);\n\n  -- Modify column\n  ALTER TABLE students MODIFY COLUMN name VARCHAR(200);\n\n  -- Rename column\n  ALTER TABLE students RENAME COLUMN dept TO department;\n\n  -- Add constraint\n  ALTER TABLE students ADD CONSTRAINT chk_gpa CHECK(gpa BETWEEN 0 AND 4);\n\n  -- Drop column\n  ALTER TABLE students DROP COLUMN phone;\n\n  -- Add index\n  ALTER TABLE students ADD INDEX idx_email (email);\n\nDROP TABLE — permanently removes table:\n  DROP TABLE IF EXISTS students;\n\nTRUNCATE TABLE — removes all rows, keeps structure:\n  TRUNCATE TABLE students;\n\nRENAME TABLE:\n  RENAME TABLE students TO learners;`, 25],
    ]],
    ['Module 2: DML & DQL (CRUD)', 'INSERT, SELECT, UPDATE, DELETE, WHERE, ORDER BY, GROUP BY.', [
      ['INSERT, UPDATE, DELETE', `INSERT — add rows:\n  INSERT INTO students (name,email,age,dept,gpa) VALUES ('Alice','alice@example.com',20,'CS',3.8);\n\n  -- Multiple rows\n  INSERT INTO students (name,email,age,dept) VALUES\n      ('Bob','bob@ex.com',21,'IT'),\n      ('Carol','carol@ex.com',22,'CS');\n\nUPDATE — modify rows:\n  UPDATE students SET gpa = 4.0 WHERE name = 'Alice';\n\n  -- Update multiple columns\n  UPDATE students SET dept = 'Data Science', gpa = 3.9 WHERE id = 2;\n\n  -- Always use WHERE! Without it, updates all rows.\n\nDELETE — remove rows:\n  DELETE FROM students WHERE id = 3;\n\n  -- Delete multiple with condition\n  DELETE FROM students WHERE gpa < 2.0;\n\n  -- NEVER run DELETE without WHERE in production!`, 25],
      ['SELECT, WHERE, ORDER BY, LIMIT', `SELECT — retrieve data:\n  SELECT * FROM students;\n  SELECT name, email, gpa FROM students;\n  SELECT name AS student_name FROM students;  -- alias\n\nWHERE clause — filter rows:\n  SELECT * FROM students WHERE dept = 'CS';\n  SELECT * FROM students WHERE gpa > 3.5;\n  SELECT * FROM students WHERE age BETWEEN 18 AND 25;\n  SELECT * FROM students WHERE name LIKE 'A%';  -- starts with A\n  SELECT * FROM students WHERE dept IN ('CS','IT');\n  SELECT * FROM students WHERE gpa IS NOT NULL;\n\nCombining conditions:\n  SELECT * FROM students WHERE dept='CS' AND gpa > 3.0;\n  SELECT * FROM students WHERE dept='CS' OR dept='IT';\n  SELECT * FROM students WHERE NOT dept='CS';\n\nORDER BY — sort results:\n  SELECT * FROM students ORDER BY gpa DESC;\n  SELECT * FROM students ORDER BY dept ASC, gpa DESC;\n\nLIMIT — restrict rows:\n  SELECT * FROM students LIMIT 5;\n  SELECT * FROM students LIMIT 5 OFFSET 10;  -- pagination`, 35],
      ['Aggregate Functions & GROUP BY', `Aggregate functions compute values across rows:\n  COUNT(*)       — number of rows\n  SUM(column)    — total\n  AVG(column)    — average\n  MAX(column)    — highest value\n  MIN(column)    — lowest value\n\n  SELECT COUNT(*) AS total FROM students;\n  SELECT AVG(gpa) AS avg_gpa FROM students WHERE dept='CS';\n  SELECT MAX(gpa), MIN(gpa) FROM students;\n  SELECT SUM(credits) FROM courses WHERE code LIKE 'CS%';\n\nGROUP BY — group rows by column:\n  SELECT dept, COUNT(*) AS count, AVG(gpa) AS avg_gpa\n  FROM students\n  GROUP BY dept;\n\nHAVING — filter groups (like WHERE for groups):\n  SELECT dept, COUNT(*) AS count\n  FROM students\n  GROUP BY dept\n  HAVING count > 5;  -- only depts with more than 5 students\n\nCombined query:\n  SELECT dept, ROUND(AVG(gpa),2) AS avg_gpa, COUNT(*) AS total\n  FROM students\n  WHERE age >= 18\n  GROUP BY dept\n  HAVING avg_gpa > 3.0\n  ORDER BY avg_gpa DESC\n  LIMIT 3;`, 35],
    ]],
    ['Module 3: Joins & Subqueries', 'INNER, LEFT, RIGHT JOIN, subqueries, EXISTS.', [
      ['INNER JOIN, LEFT JOIN, RIGHT JOIN', `Joins combine rows from multiple tables:\n\nSample tables:\n  students(id, name, dept_id)\n  departments(id, name, head)\n  enrollments(student_id, course_id, grade)\n\nINNER JOIN — only matching rows:\n  SELECT s.name, d.name AS dept\n  FROM students s\n  INNER JOIN departments d ON s.dept_id = d.id;\n\nLEFT JOIN — all from left, matching from right (NULL if no match):\n  SELECT s.name, e.grade\n  FROM students s\n  LEFT JOIN enrollments e ON s.id = e.student_id;\n  -- Shows all students, even those not enrolled\n\nRIGHT JOIN — all from right, matching from left:\n  SELECT s.name, c.title\n  FROM enrollments e\n  RIGHT JOIN courses c ON e.course_id = c.id;\n  -- Shows all courses, even those with no enrollment\n\nMultiple joins:\n  SELECT s.name, c.title, e.grade\n  FROM students s\n  JOIN enrollments e ON s.id = e.student_id\n  JOIN courses c ON e.course_id = c.id\n  WHERE s.dept_id = 1\n  ORDER BY e.grade DESC;`, 40],
      ['Subqueries & EXISTS', `Subquery — a query nested inside another query:\n\n  -- Students with above-average GPA\n  SELECT name, gpa FROM students\n  WHERE gpa > (SELECT AVG(gpa) FROM students);\n\n  -- Subquery in FROM (derived table)\n  SELECT dept, avg_gpa\n  FROM (SELECT dept, AVG(gpa) AS avg_gpa FROM students GROUP BY dept) AS dept_avg\n  WHERE avg_gpa > 3.5;\n\n  -- Correlated subquery (references outer query)\n  SELECT name FROM students s\n  WHERE gpa = (SELECT MAX(gpa) FROM students WHERE dept = s.dept);\n  -- Gets top student per department\n\nEXISTS — checks if subquery returns any rows:\n  SELECT name FROM students s\n  WHERE EXISTS (\n      SELECT 1 FROM enrollments e WHERE e.student_id = s.id\n  );\n  -- Students who are enrolled in at least one course\n\nIN with subquery:\n  SELECT name FROM students\n  WHERE dept_id IN (SELECT id FROM departments WHERE head = 'Dr. Kumar');`, 35],
    ]],
  ];

  for (let mi = 0; mi < mysqlModules.length; mi++) {
    const [modTitle, modSummary, lessons] = mysqlModules[mi];
    const mod = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
      [mysqlId, modTitle, modSummary, mi + 1]);
    for (let li = 0; li < lessons.length; li++) {
      await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
        [mod.lastID, lessons[li][0], lessons[li][1], lessons[li][2], li + 1]);
    }
  }

  // MySQL quiz
  const mysqlQuiz = await db.run(`INSERT INTO quizzes (course_id,title,description,time_limit_minutes,passing_score,order_index) VALUES (?,?,?,?,?,?)`,
    [mysqlId, 'SQL Fundamentals Quiz', 'Test your SQL query writing and database design knowledge.', 20, 60, 1]);
  const mysqlQuizId = mysqlQuiz.lastID;
  const mysqlMcq = [
    ['Which SQL command retrieves data from a table?', 'SELECT', 'GET', 'FETCH', 'RETRIEVE', 'A', 'SELECT is the standard SQL command for querying data.'],
    ['Which clause filters rows AFTER grouping?', 'HAVING', 'WHERE', 'FILTER', 'GROUP', 'A', 'HAVING filters groups, WHERE filters individual rows before grouping.'],
    ['Which JOIN returns all rows from the left table?', 'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'FULL JOIN', 'A', 'LEFT JOIN returns all rows from the left table, with NULLs for unmatched right rows.'],
    ['Which aggregate function counts rows?', 'COUNT', 'SUM', 'TOTAL', 'NUM', 'A', 'COUNT(*) counts all rows, COUNT(col) counts non-NULL values.'],
    ['Which constraint ensures no duplicate values?', 'UNIQUE', 'NOT NULL', 'CHECK', 'DEFAULT', 'A', 'UNIQUE constraint prevents duplicate values in a column.'],
  ];
  for (let i = 0; i < mysqlMcq.length; i++) {
    const q = mysqlMcq[i];
    await db.run(`INSERT INTO quiz_questions (quiz_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [mysqlQuizId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], i + 1]);
  }

  // ──────────────────────────────────────────────────────────
  // COURSE 4: JDBC
  // ──────────────────────────────────────────────────────────
  const jdbc = await db.run(`INSERT INTO courses (code,title,description,instructor,credits,image_url) VALUES (?,?,?,?,?,?)`, [
    'JAVA401',
    'JDBC – Java Database Connectivity',
    'Connect Java applications to MySQL databases. Covers DriverManager, Connection, Statement, PreparedStatement, ResultSet, and transactions.',
    'Prof. Ramesh Iyer',
    3,
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80'
  ]);
  const jdbcId = jdbc.lastID;

  const jdbcModules = [
    ['Module 1: JDBC Architecture & Setup', 'JDBC API layers, loading drivers, connecting to MySQL.', [
      ['JDBC Architecture & Drivers', `JDBC (Java Database Connectivity) is an API that enables Java programs to interact with databases.\n\nArchitecture layers:\n  Java Application\n       ↓\n  JDBC API (java.sql.*)\n       ↓\n  JDBC Driver Manager\n       ↓\n  JDBC Driver (MySQL Connector/J)\n       ↓\n  MySQL Database\n\nJDBC Driver types:\n  Type 1 — JDBC-ODBC Bridge (deprecated)\n  Type 2 — Native-API driver\n  Type 3 — Network Protocol driver\n  Type 4 — Thin/Pure Java driver ← MySQL Connector/J (recommended)\n\nKey JDBC interfaces (java.sql):\n  DriverManager  — manages database drivers\n  Connection     — represents a DB connection\n  Statement      — executes SQL\n  PreparedStatement — parameterized SQL\n  ResultSet      — holds query results\n  CallableStatement — stored procedures\n\nMaven dependency (pom.xml):\n  <dependency>\n    <groupId>com.mysql</groupId>\n    <artifactId>mysql-connector-j</artifactId>\n    <version>8.3.0</version>\n  </dependency>`, 30],
      ['Connecting to MySQL Database', `Step-by-step JDBC connection:\n\nimport java.sql.*;\n\npublic class DBConnection {\n    private static final String URL =\n        "jdbc:mysql://localhost:3306/school";\n    private static final String USER = "root";\n    private static final String PASS = "your_password";\n\n    public static Connection getConnection() throws SQLException {\n        return DriverManager.getConnection(URL, USER, PASS);\n    }\n\n    public static void main(String[] args) {\n        try (Connection conn = getConnection()) {\n            System.out.println("Connected: " + conn.getCatalog());\n        } catch (SQLException e) {\n            System.out.println("Connection failed: " + e.getMessage());\n            System.out.println("SQLState: " + e.getSQLState());\n        }\n    }\n}\n\nJDBC URL format:\n  jdbc:mysql://host:port/database?params\n  jdbc:mysql://localhost:3306/school?useSSL=false&serverTimezone=UTC\n\nBest practice: use try-with-resources — auto-closes Connection\nNever hardcode credentials in production — use environment variables`, 35],
    ]],
    ['Module 2: CRUD with JDBC', 'Statement vs PreparedStatement, ResultSet, executing queries.', [
      ['Statement & ResultSet – SELECT', `Using Statement for SELECT:\n\nimport java.sql.*;\n\ntry (Connection conn = DBConnection.getConnection();\n     Statement stmt = conn.createStatement()) {\n\n    String sql = "SELECT * FROM students ORDER BY name";\n    ResultSet rs = stmt.executeQuery(sql);\n\n    while (rs.next()) {\n        int id     = rs.getInt("id");\n        String name = rs.getString("name");\n        String email = rs.getString("email");\n        double gpa  = rs.getDouble("gpa");\n        System.out.printf("%-4d %-20s %-25s %.2f%n", id, name, email, gpa);\n    }\n} catch (SQLException e) {\n    e.printStackTrace();\n}\n\nResultSet navigation:\n  rs.next()      — move to next row (returns false at end)\n  rs.first()     — first row\n  rs.last()      — last row\n  rs.absolute(n) — move to row n\n\nResultSet getters:\n  rs.getInt("column")     or rs.getInt(1)  (column index)\n  rs.getString("column")\n  rs.getDouble("column")\n  rs.getDate("column")\n  rs.getBoolean("column")\n  rs.wasNull()  — check if last get() returned null`, 35],
      ['PreparedStatement – Safe CRUD', `PreparedStatement is precompiled and prevents SQL injection:\n\n// INSERT\nString insertSQL = "INSERT INTO students (name,email,gpa) VALUES (?,?,?)";\ntry (PreparedStatement ps = conn.prepareStatement(insertSQL)) {\n    ps.setString(1, "Alice");\n    ps.setString(2, "alice@ex.com");\n    ps.setDouble(3, 3.8);\n    int rows = ps.executeUpdate();\n    System.out.println(rows + " row(s) inserted");\n}\n\n// UPDATE\nString updateSQL = "UPDATE students SET gpa=? WHERE id=?";\ntry (PreparedStatement ps = conn.prepareStatement(updateSQL)) {\n    ps.setDouble(1, 4.0);\n    ps.setInt(2, 1);\n    ps.executeUpdate();\n}\n\n// DELETE\nString deleteSQL = "DELETE FROM students WHERE id=?";\ntry (PreparedStatement ps = conn.prepareStatement(deleteSQL)) {\n    ps.setInt(1, 5);\n    ps.executeUpdate();\n}\n\n// SELECT with parameter\nString searchSQL = "SELECT * FROM students WHERE dept=? AND gpa>?";\ntry (PreparedStatement ps = conn.prepareStatement(searchSQL)) {\n    ps.setString(1, "CS");\n    ps.setDouble(2, 3.5);\n    ResultSet rs = ps.executeQuery();\n    while (rs.next()) { ... }\n}\n\nALWAYS use PreparedStatement for user input — prevents SQL injection`, 40],
    ]],
    ['Module 3: Transactions & Best Practices', 'ACID, commit/rollback, batch updates, connection pooling.', [
      ['Transactions – commit & rollback', `Transactions ensure ACID properties:\n  Atomicity   — all or nothing\n  Consistency — data stays valid\n  Isolation   — transactions don't interfere\n  Durability  — committed changes persist\n\nJDBC transaction example (bank transfer):\n\ntry (Connection conn = DBConnection.getConnection()) {\n\n    conn.setAutoCommit(false); // begin transaction\n\n    try {\n        // Debit\n        PreparedStatement debit = conn.prepareStatement(\n            "UPDATE accounts SET balance=balance-? WHERE id=?");\n        debit.setDouble(1, 500.00);\n        debit.setInt(2, 1);\n        debit.executeUpdate();\n\n        // Credit\n        PreparedStatement credit = conn.prepareStatement(\n            "UPDATE accounts SET balance=balance+? WHERE id=?");\n        credit.setDouble(1, 500.00);\n        credit.setInt(2, 2);\n        credit.executeUpdate();\n\n        conn.commit(); // save both changes\n        System.out.println("Transfer successful");\n\n    } catch (SQLException e) {\n        conn.rollback(); // undo everything\n        System.out.println("Transfer failed, rolled back: " + e.getMessage());\n    }\n}`, 40],
      ['Batch Updates & DAO Pattern', `Batch processing — execute multiple statements efficiently:\n\nconn.setAutoCommit(false);\nPreparedStatement ps = conn.prepareStatement(\n    "INSERT INTO students (name,email) VALUES (?,?)");\n\nString[][] data = {{"Alice","a@ex.com"},{"Bob","b@ex.com"},{"Carol","c@ex.com"}};\nfor (String[] row : data) {\n    ps.setString(1, row[0]);\n    ps.setString(2, row[1]);\n    ps.addBatch();  // queue the statement\n}\nint[] results = ps.executeBatch(); // execute all at once\nconn.commit();\n\nDAO (Data Access Object) Pattern:\n  Separates database logic from business logic\n\n  interface StudentDAO {\n      void insert(Student s);\n      Student findById(int id);\n      List<Student> findAll();\n      void update(Student s);\n      void delete(int id);\n  }\n\n  class StudentDAOImpl implements StudentDAO {\n      private Connection conn;\n      StudentDAOImpl(Connection conn) { this.conn = conn; }\n\n      public void insert(Student s) throws SQLException {\n          String sql = "INSERT INTO students (name,email,gpa) VALUES (?,?,?)";\n          try (PreparedStatement ps = conn.prepareStatement(sql)) {\n              ps.setString(1, s.getName());\n              ps.setString(2, s.getEmail());\n              ps.setDouble(3, s.getGpa());\n              ps.executeUpdate();\n          }\n      }\n      // ... other methods\n  }`, 40],
    ]],
  ];

  for (let mi = 0; mi < jdbcModules.length; mi++) {
    const [modTitle, modSummary, lessons] = jdbcModules[mi];
    const mod = await db.run(`INSERT INTO modules (course_id,title,summary,order_index) VALUES (?,?,?,?)`,
      [jdbcId, modTitle, modSummary, mi + 1]);
    for (let li = 0; li < lessons.length; li++) {
      await db.run(`INSERT INTO lessons (module_id,title,content,duration,order_index) VALUES (?,?,?,?,?)`,
        [mod.lastID, lessons[li][0], lessons[li][1], lessons[li][2], li + 1]);
    }
  }

  // JDBC quiz
  const jdbcQuiz = await db.run(`INSERT INTO quizzes (course_id,title,description,time_limit_minutes,passing_score,order_index) VALUES (?,?,?,?,?,?)`,
    [jdbcId, 'JDBC Fundamentals Quiz', 'Test your knowledge of JDBC connections, queries, and transactions.', 20, 60, 1]);
  const jdbcQuizId = jdbcQuiz.lastID;
  const jdbcMcq = [
    ['Which class manages database connections in JDBC?', 'DriverManager', 'ConnectionManager', 'DBManager', 'JDBCDriver', 'A', 'DriverManager.getConnection() establishes a database connection.'],
    ['Which method executes a SELECT query?', 'executeQuery()', 'executeUpdate()', 'execute()', 'query()', 'A', 'executeQuery() returns a ResultSet for SELECT statements.'],
    ['Which statement prevents SQL injection?', 'PreparedStatement', 'Statement', 'CallableStatement', 'SafeStatement', 'A', 'PreparedStatement uses parameterized queries with ? placeholders.'],
    ['What does conn.setAutoCommit(false) do?', 'Starts a manual transaction', 'Closes the connection', 'Disables SQL', 'Enables batch mode', 'A', 'Setting autoCommit to false enables manual transaction control with commit/rollback.'],
    ['Which ResultSet method moves to the next row?', 'next()', 'advance()', 'moveNext()', 'nextRow()', 'A', 'rs.next() moves the cursor to the next row, returning false when there are no more rows.'],
  ];
  for (let i = 0; i < jdbcMcq.length; i++) {
    const q = jdbcMcq[i];
    await db.run(`INSERT INTO quiz_questions (quiz_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [jdbcQuizId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], i + 1]);
  }

  // JDBC assignment
  await db.run(`INSERT INTO assignments (course_id,title,description,instructions,due_date,max_score,order_index) VALUES (?,?,?,?,?,?,?)`, [
    jdbcId, 'Assignment: Student CRUD Application',
    'Build a full Java console application that performs CRUD operations on a MySQL students table.',
    `Create a Java application with:\n\n1. Database setup: Create a schema called "school" with a students table\n   (id INT PK AUTO_INCREMENT, name VARCHAR(100), email VARCHAR(150) UNIQUE, dept VARCHAR(50), gpa DECIMAL(3,2))\n\n2. DBConnection.java — utility class with getConnection() method\n\n3. StudentDAO interface with:\n   - void insertStudent(String name, String email, String dept, double gpa)\n   - void listAllStudents()\n   - void updateGpa(int id, double newGpa)\n   - void deleteStudent(int id)\n   - void searchByDept(String dept)\n\n4. StudentDAOImpl implementing the interface using PreparedStatements\n\n5. Main.java — menu-driven console app:\n   1. Add student\n   2. View all students\n   3. Update GPA\n   4. Delete student\n   5. Search by department\n   6. Exit\n\nEnsure proper exception handling and use try-with-resources for all JDBC objects.`,
    '2026-10-15', 100, 1
  ]);

  // Auto-enroll seed student in Java Foundation and Core Java
  if (studentId) {
    await db.run(`INSERT OR IGNORE INTO enrollments (student_id,course_id,grade) VALUES (?,?,?)`, [studentId, jfId, 'In Progress']);
    await db.run(`INSERT OR IGNORE INTO enrollments (student_id,course_id,grade) VALUES (?,?,?)`, [studentId, cjId, 'In Progress']);
  }

  console.log('✅ Seeded 4 courses: Java Foundation, Core Java, MySQL, JDBC with modules, lessons, quizzes, coding questions & assignments.');
}

module.exports = { getDB };
