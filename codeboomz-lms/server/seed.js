// Demo data for CodeBoomz LMS. Dates are relative to today so the demo always looks "live".
// Usage: npm run seed   (only if empty)   |   npm run reset   (wipe + reseed)
const { db, all, get, run, tx } = require('./db');
const { hashPassword } = require('./auth');
const { today, addDays } = require('./util');
const I = require('./insights');

// deterministic PRNG so every reset looks the same
let s = 20261124;
const rand = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

const COURSES = [
  { code: 'MERN', title: 'MERN Stack Development', fee: 40000, weeks: 20, color: '#12b886', desc: 'MongoDB, Express, React and Node.js — build and deploy full-stack JavaScript apps.' },
  { code: 'JFS', title: 'Java Full Stack', fee: 45000, weeks: 24, color: '#ff7a45', desc: 'Core Java, Spring Boot, Hibernate, REST APIs, React and SQL.' },
  { code: 'PFS', title: 'Python Full Stack', fee: 42000, weeks: 22, color: '#228be6', desc: 'Python, Django, FastAPI, PostgreSQL and React.' },
  { code: 'DS', title: 'Data Science & ML', fee: 55000, weeks: 26, color: '#7950f2', desc: 'Python, statistics, Pandas, ML models and real-world case studies.' },
  { code: 'GENAI', title: 'Generative AI Engineering', fee: 35000, weeks: 12, color: '#e64980', desc: 'LLMs, prompt engineering, RAG pipelines and AI agents.' },
  { code: 'CYB', title: 'Cybersecurity Essentials', fee: 38000, weeks: 16, color: '#15aabf', desc: 'Networking, ethical hacking, SOC operations and cloud security.' },
];
const TOPICS = {
  MERN: ['HTML & CSS refresher', 'Modern JavaScript (ES6+)', 'DOM & Events', 'Async JS & Promises', 'Node.js fundamentals', 'Express routing', 'REST API design', 'MongoDB & Mongoose', 'Auth with JWT', 'React basics', 'React hooks', 'State management', 'React Router', 'Deploying to the cloud', 'Testing with Jest'],
  JFS: ['Java basics', 'OOP in Java', 'Collections', 'Exceptions', 'Streams & Lambdas', 'JDBC', 'SQL joins', 'Spring Core', 'Spring Boot REST', 'JPA & Hibernate', 'Spring Security', 'Microservices intro', 'React for Java devs', 'Docker basics'],
  PFS: ['Python basics', 'Data structures in Python', 'Functions & modules', 'OOP in Python', 'File handling', 'Django models', 'Django views', 'Django REST framework', 'FastAPI', 'PostgreSQL', 'React basics', 'Deployment'],
  DS: ['Python for data', 'NumPy', 'Pandas', 'Data cleaning', 'Visualisation', 'Statistics', 'Probability', 'Linear regression', 'Classification', 'Decision trees', 'Clustering', 'Model evaluation', 'Feature engineering'],
  GENAI: ['How LLMs work', 'Prompt engineering', 'Embeddings', 'Vector databases', 'Building RAG', 'Function calling', 'AI agents', 'Evaluation & safety'],
};
const MENTORS = [
  { name: 'Priya Sharma', email: 'priya@codeboomz.com', phone: '+91 98450 11223' },
  { name: 'Rahul Verma', email: 'rahul@codeboomz.com', phone: '+91 98860 44556' },
  { name: 'Ananya Iyer', email: 'ananya@codeboomz.com', phone: '+91 99000 77889' },
];
// [code, name, mentorIndex, daysAgoStarted, weekdays(0=Sun), time, schedule]
const BATCHES = [
  ['MERN', 'MERN · Nov Evening', 0, 35, [1, 3, 5], '19:00', 'Mon · Wed · Fri, 7:00 PM'],
  ['JFS', 'Java FS · Aug Morning', 1, 98, [2, 4, 6], '08:00', 'Tue · Thu · Sat, 8:00 AM'],
  ['PFS', 'Python FS · Oct Batch', 2, 49, [1, 3, 5], '09:30', 'Mon · Wed · Fri, 9:30 AM'],
  ['DS', 'Data Science · Weekend', 2, 70, [6, 0], '11:00', 'Sat · Sun, 11:00 AM'],
  ['GENAI', 'GenAI · Nov Cohort', 0, 14, [2, 4], '20:00', 'Tue · Thu, 8:00 PM'],
];
const STUDENT_NAMES = ['Aarav Mehta', 'Diya Patel', 'Vivaan Reddy', 'Ishita Rao', 'Kabir Singh', 'Meera Nair', 'Arjun Kumar', 'Sneha Gupta', 'Rohan Das', 'Ananya Joshi', 'Aditya Menon', 'Kavya Pillai', 'Siddharth Jain', 'Pooja Hegde', 'Nikhil Bhat', 'Riya Kapoor', 'Varun Shetty', 'Tanvi Desai', 'Harsh Agarwal', 'Nandini Sinha', 'Yash Chauhan', 'Aditi Kulkarni', 'Karthik Raman', 'Shreya Ghosh', 'Manav Arora', 'Lakshmi Prasad', 'Dev Malhotra', 'Zoya Khan'];
// profile per student, and batch indexes
const PLAN = [
  ['good', [0, 4]], ['star', [0]], ['avg', [0]], ['struggling', [0]], ['ghost', [0]], ['good', [0]], ['avg', [0]],
  ['star', [1]], ['good', [1]], ['avg', [1]], ['struggling', [1]], ['good', [1]], ['ghost', [1]],
  ['star', [2]], ['avg', [2]], ['good', [2]], ['struggling', [2]], ['avg', [2]], ['good', [2]],
  ['good', [3]], ['star', [3]], ['avg', [3]], ['struggling', [3]], ['good', [3]],
  ['star', [4]], ['avg', [4]], ['good', [4]], ['ghost', [4]],
];
const PROFILE = {
  star: { att: 0.97, sub: 1, marks: [85, 98], solve: [7, 10], streak: [9, 14], last: 0, pay: 1 },
  good: { att: 0.9, sub: 0.95, marks: [72, 90], solve: [4, 6], streak: [3, 6], last: 1, pay: 1 },
  avg: { att: 0.8, sub: 0.85, marks: [58, 78], solve: [2, 4], streak: [1, 3], last: 2, pay: 0.7 },
  struggling: { att: 0.58, sub: 0.55, marks: [35, 58], solve: [0, 1], streak: [0, 1], last: 5, pay: 0.4 },
  ghost: { att: 0.85, sub: 0.6, marks: [50, 70], solve: [0, 1], streak: [0, 0], last: 10, pay: 0.2, drop: true },
};

const CHALLENGES = [
  { title: 'Sum of Two Numbers', difficulty: 'easy', language: 'javascript', topic: 'Basics', fn: 'sum', xp: 20,
    description: 'Write a function `sum(a, b)` that returns the sum of two numbers.\n\nExample: `sum(2, 3)` → `5`',
    starter: 'function sum(a, b) {\n  // your code here\n}\n',
    tests: [[[2, 3], 5], [[-1, 1], 0], [[10, 15], 25], [[0, 0], 0, 1], [[1.5, 2.5], 4, 1]] },
  { title: 'Reverse a String', difficulty: 'easy', language: 'javascript', topic: 'Strings', fn: 'reverseString', xp: 20,
    description: 'Return the given string reversed.\n\nExample: `reverseString("boom")` → `"moob"`',
    starter: 'function reverseString(str) {\n  // your code here\n}\n',
    tests: [[['boom'], 'moob'], [['CodeBoomz'], 'zmooBedoC'], [[''], ''], [['a'], 'a', 1], [['racecar'], 'racecar', 1]] },
  { title: 'FizzBuzz List', difficulty: 'easy', language: 'python', topic: 'Loops', fn: 'fizzbuzz', xp: 25,
    description: 'Return a list of strings from 1 to n. For multiples of 3 use "Fizz", multiples of 5 use "Buzz", and multiples of both use "FizzBuzz".\n\nExample: `fizzbuzz(5)` → `["1","2","Fizz","4","Buzz"]`',
    starter: 'def fizzbuzz(n):\n    # your code here\n    pass\n',
    tests: [[[5], ['1', '2', 'Fizz', '4', 'Buzz']], [[3], ['1', '2', 'Fizz']], [[1], ['1']], [[15], ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'], 1]] },
  { title: 'Palindrome Checker', difficulty: 'easy', language: 'python', topic: 'Strings', fn: 'is_palindrome', xp: 25,
    description: 'Return `True` if the string is a palindrome, ignoring case, spaces and punctuation.\n\nExample: `is_palindrome("A man, a plan, a canal: Panama")` → `True`',
    starter: 'def is_palindrome(s):\n    # your code here\n    pass\n',
    tests: [[['A man, a plan, a canal: Panama'], true], [['hello'], false], [['Was it a car or a cat I saw?'], true], [[''], true, 1], [['ab'], false, 1]] },
  { title: 'Count the Vowels', difficulty: 'easy', language: 'javascript', topic: 'Strings', fn: 'countVowels', xp: 20,
    description: 'Return how many vowels (a, e, i, o, u — any case) appear in the string.\n\nExample: `countVowels("CodeBoomz")` → `4`',
    starter: 'function countVowels(str) {\n  // your code here\n}\n',
    tests: [[['CodeBoomz'], 4], [['xyz'], 0], [['AEIOU'], 5], [['Full Stack Developer'], 6, 1]] },
  { title: 'Binary Search', difficulty: 'easy', language: 'python', topic: 'Searching', fn: 'binary_search', xp: 30,
    description: 'Given a sorted list `nums` and a `target`, return the index of target, or `-1` if it is not present. Aim for O(log n).',
    starter: 'def binary_search(nums, target):\n    # your code here\n    pass\n',
    tests: [[[[1, 3, 5, 7, 9], 7], 3], [[[1, 3, 5, 7, 9], 4], -1], [[[2], 2], 0], [[[], 1], -1, 1], [[[1, 2, 3, 4, 5, 6, 7, 8], 1], 0, 1]] },
  { title: 'Two Sum', difficulty: 'medium', language: 'javascript', topic: 'Arrays & Hashing', fn: 'twoSum', xp: 40,
    description: 'Return the indices `[i, j]` (i < j) of the two numbers in `nums` that add up to `target`. Exactly one solution exists.\n\nExample: `twoSum([2,7,11,15], 9)` → `[0,1]`',
    starter: 'function twoSum(nums, target) {\n  // your code here\n}\n',
    tests: [[[[2, 7, 11, 15], 9], [0, 1]], [[[3, 2, 4], 6], [1, 2]], [[[3, 3], 6], [0, 1]], [[[1, 5, 9, 14], 23], [2, 3], 1]] },
  { title: 'Valid Parentheses', difficulty: 'medium', language: 'python', topic: 'Stacks', fn: 'is_valid', xp: 40,
    description: 'Given a string with only `()[]{}`, return `True` if every bracket is closed in the correct order.\n\nExample: `is_valid("([]{})")` → `True`',
    starter: 'def is_valid(s):\n    # your code here\n    pass\n',
    tests: [[['()'], true], [['([]{})'], true], [['(]'], false], [['(('], false, 1], [['{[()()]}'], true, 1]] },
  { title: 'Maximum Subarray', difficulty: 'medium', language: 'javascript', topic: 'Dynamic Programming', fn: 'maxSubArray', xp: 45,
    description: 'Return the largest sum of any contiguous subarray (Kadane\'s algorithm).\n\nExample: `maxSubArray([-2,1,-3,4,-1,2,1,-5,4])` → `6`',
    starter: 'function maxSubArray(nums) {\n  // your code here\n}\n',
    tests: [[[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 6], [[[1]], 1], [[[5, 4, -1, 7, 8]], 23], [[[-3, -1, -2]], -1, 1]] },
  { title: 'Flatten a Nested Array', difficulty: 'medium', language: 'javascript', topic: 'Recursion', fn: 'flatten', xp: 40,
    description: 'Flatten an arbitrarily nested array into a single array. Do not use `Array.prototype.flat`.\n\nExample: `flatten([1,[2,[3,[4]]]])` → `[1,2,3,4]`',
    starter: 'function flatten(arr) {\n  // your code here\n}\n',
    tests: [[[[1, [2, [3, [4]]]]], [1, 2, 3, 4]], [[[[]]], []], [[[1, 2, 3]], [1, 2, 3]], [[[[[['x']]], 'y']], ['x', 'y'], 1]] },
  { title: 'Longest Substring Without Repeats', difficulty: 'hard', language: 'python', topic: 'Sliding Window', fn: 'longest_unique', xp: 60,
    description: 'Return the length of the longest substring without repeating characters.\n\nExample: `longest_unique("abcabcbb")` → `3`',
    starter: 'def longest_unique(s):\n    # your code here\n    pass\n',
    tests: [[['abcabcbb'], 3], [['bbbbb'], 1], [['pwwkew'], 3], [[''], 0, 1], [['dvdf'], 3, 1]] },
  { title: 'Merge Intervals', difficulty: 'hard', language: 'javascript', topic: 'Sorting', fn: 'mergeIntervals', xp: 60,
    description: 'Merge all overlapping intervals and return them sorted by start.\n\nExample: `mergeIntervals([[1,3],[2,6],[8,10]])` → `[[1,6],[8,10]]`',
    starter: 'function mergeIntervals(intervals) {\n  // your code here\n}\n',
    tests: [[[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]], [[[[1, 4], [4, 5]]], [[1, 5]]], [[[[5, 6], [1, 2]]], [[1, 2], [5, 6]]], [[[[1, 10], [2, 3], [4, 5]]], [[1, 10]], 1]] },
];

const ASSIGNMENT_TEMPLATES = [
  { type: 'written', title: 'Explain the request–response cycle', desc: 'In 300–500 words, explain what happens from typing a URL to seeing a page. Include DNS, HTTP and rendering.' },
  { type: 'code', title: 'Code Lab: Reverse a String', ch: 'Reverse a String' },
  { type: 'project', title: 'Mini project: Personal portfolio', desc: 'Build and deploy a responsive portfolio. Submit the GitHub repo and live link.' },
  { type: 'written', title: 'Debugging journal', desc: 'Describe one bug you faced this week, how you found it and how you fixed it.' },
  { type: 'code', title: 'Code Lab: Two Sum', ch: 'Two Sum' },
  { type: 'project', title: 'Capstone milestone 1: Wireframes & DB design', desc: 'Share wireframes (Figma link) and an ER diagram for your capstone project.' },
  { type: 'code', title: 'Code Lab: Valid Parentheses', ch: 'Valid Parentheses' },
];

const BATCH_CHALLENGES = {
  MERN: ['Reverse a String', 'Two Sum', 'Valid Parentheses'],
  JFS: ['Sum of Two Numbers', 'Binary Search', 'Maximum Subarray'],
  PFS: ['FizzBuzz List', 'Palindrome Checker', 'Valid Parentheses'],
  DS: ['Binary Search', 'Two Sum', 'Longest Substring Without Repeats'],
  GENAI: ['Count the Vowels', 'Flatten a Nested Array', 'Maximum Subarray'],
};
const PROJECTS = {
  MERN: [['Mini project: Personal portfolio', 'Build and deploy a responsive portfolio. Submit the GitHub repo and live link.'], ['Capstone milestone 1: Wireframes & DB design', 'Share wireframes (Figma link) and an ER diagram for your MERN capstone.']],
  JFS: [['Mini project: Library management REST API', 'Spring Boot + MySQL API with CRUD for books and members. Submit the repo.'], ['Capstone milestone 1: Microservice design', 'Submit your service diagram and API contracts.']],
  PFS: [['Mini project: Django blog', 'A blog with auth, posts and comments. Submit repo and deployed link.'], ['Capstone milestone 1: Requirements & schema', 'Submit user stories and your PostgreSQL schema.']],
  DS: [['Mini project: EDA on Indian housing prices', 'Clean the dataset, visualise key trends and share your notebook link.'], ['Capstone milestone 1: Problem framing', 'Define the ML problem, metric and baseline for your capstone.']],
  GENAI: [['Mini project: Prompt library', 'Create 10 reusable prompts with test cases for a business use case.'], ['Capstone milestone 1: RAG chatbot plan', 'Architecture diagram for a RAG chatbot over CodeBoomz course notes.']],
};

const SOLUTIONS = {
  sum: 'function sum(a, b) {\n  return a + b;\n}\n',
  reverseString: "function reverseString(str) {\n  return str.split('').reverse().join('');\n}\n",
};

function wipe() {
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of ['sessions', 'interventions', 'badges', 'xp_events', 'notifications', 'announcements', 'fees', 'code_attempts', 'submissions', 'assignments', 'challenges', 'attendance', 'classes', 'enrollments', 'batches', 'courses', 'users']) db.exec(`DELETE FROM ${t}`);
  db.exec("DELETE FROM sqlite_sequence");
  db.exec('PRAGMA foreign_keys = ON');
}

function seed() {
  const T = today();
  const { hash, salt } = hashPassword('demo123'); // same demo password for all accounts
  const COLORS = ['#6d5efc', '#ff7a45', '#12b886', '#228be6', '#e64980', '#fab005', '#15aabf', '#7950f2', '#fd7e14', '#40c057'];
  const addUser = (name, email, role, phone) => Number(run('INSERT INTO users (name, email, phone, role, password_hash, salt, avatar_color, created_at) VALUES (?,?,?,?,?,?,?,?)',
    name, email, phone || null, role, hash, salt, pick(COLORS), addDays(T, -120) + ' 10:00:00').lastInsertRowid);
  const xp = (uid, pts, reason, ref, when) => run('INSERT OR IGNORE INTO xp_events (user_id, points, reason, ref, created_at) VALUES (?,?,?,?,?)', uid, pts, reason, ref, when);

  tx(() => {
    const adminId = addUser('Vikram Rao', 'admin@codeboomz.com', 'admin', '+91 90000 12345');
    const mentorIds = MENTORS.map((m) => addUser(m.name, m.email, 'mentor', m.phone));
    const courseIds = {};
    for (const c of COURSES) courseIds[c.code] = Number(run('INSERT INTO courses (title, code, description, duration_weeks, fee, color) VALUES (?,?,?,?,?,?)', c.title, c.code, c.desc, c.weeks, c.fee, c.color).lastInsertRowid);

    const chIds = {};
    for (const c of CHALLENGES) {
      const tests = c.tests.map(([args, expected, hidden]) => ({ args, expected, ...(hidden ? { hidden: true } : {}) }));
      const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      chIds[c.title] = Number(run('INSERT INTO challenges (title, slug, difficulty, language, topic, description, function_name, starter_code, tests, xp, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        c.title, slug, c.difficulty, c.language, c.topic, c.description, c.fn, c.starter, JSON.stringify(tests), c.xp, mentorIds[0]).lastInsertRowid);
    }
    const challengeRows = all('SELECT id, title, xp, difficulty, function_name FROM challenges ORDER BY id');

    // batches + classes
    const batches = BATCHES.map(([code, name, mi, ago, days, time, schedule]) => {
      const start = addDays(T, -ago);
      const meet = `https://meet.google.com/cbz-${code.toLowerCase()}-${between(100, 999)}`;
      const id = Number(run('INSERT INTO batches (course_id, name, mentor_id, start_date, schedule, meet_link) VALUES (?,?,?,?,?,?)', courseIds[code], name, mentorIds[mi], start, schedule, meet).lastInsertRowid);
      const classes = [];
      let n = 0;
      for (let d = start; d <= addDays(T, 12); d = addDays(d, 1)) {
        const [y, m, dd] = d.split('-').map(Number);
        if (!days.includes(new Date(y, m - 1, dd).getDay())) continue;
        const topics = TOPICS[code];
        const ti = Math.floor(n / 3);
        const title = ti < topics.length ? `${topics[ti]}${n % 3 ? ' — part ' + ((n % 3) + 1) : ''}` : `Capstone project lab ${n - topics.length * 3 + 1}`;
        const cid = Number(run('INSERT INTO classes (batch_id, title, date, start_time, duration_min, meet_link, recording_url) VALUES (?,?,?,?,?,?,?)',
          id, title, d, time, 90, meet, d < T ? `https://drive.google.com/cbz-rec-${id}-${n}` : null).lastInsertRowid);
        classes.push({ id: cid, date: d });
        n++;
      }
      return { id, code, mi, start, classes, mentorId: mentorIds[mi] };
    });

    // assignments per batch
    for (const b of batches) {
      const span = Math.max(14, -((Date.parse(b.start) - Date.parse(T)) / 864e5));
      const codeSet = BATCH_CHALLENGES[b.code];
      let ci = 0;
      b.assignments = ASSIGNMENT_TEMPLATES.map((base, i) => {
        const tpl = { ...base };
        if (tpl.type === 'code') { tpl.ch = codeSet[ci++ % codeSet.length]; tpl.title = 'Code Lab: ' + tpl.ch; }
        if (tpl.type === 'project' && PROJECTS[b.code]) { const pj = PROJECTS[b.code][i < 4 ? 0 : 1]; tpl.title = pj[0]; tpl.desc = pj[1]; }
        // spread due dates from start+7 to today+10
        const due = addDays(b.start, Math.round(7 + ((span + 3) * i) / (ASSIGNMENT_TEMPLATES.length - 1)));
        const chId = tpl.ch ? chIds[tpl.ch] : null;
        const id = Number(run('INSERT INTO assignments (batch_id, title, description, type, challenge_id, due_date, max_marks, created_at) VALUES (?,?,?,?,?,?,?,?)',
          b.id, tpl.title, tpl.desc || 'Solve this challenge in the Code Lab. Your submission is auto-graded against hidden test cases.', tpl.type, chId, due, tpl.type === 'project' ? 50 : 20, addDays(due, -7) + ' 09:00:00').lastInsertRowid);
        return { id, due, type: tpl.type, max: tpl.type === 'project' ? 50 : 20, chId };
      });
    }

    // students
    STUDENT_NAMES.forEach((name, idx) => {
      const [profileKey, bIdx] = PLAN[idx];
      const P = PROFILE[profileKey];
      const first = name.split(' ')[0].toLowerCase();
      const sid = addUser(name, `${first}@student.codeboomz.com`, 'student', `+91 9${between(100000000, 999999999)}`);
      const isDemo = idx === 0;
      for (const bi of bIdx) {
        const b = batches[bi];
        run('INSERT INTO enrollments (batch_id, student_id, joined_at) VALUES (?,?,?)', b.id, sid, b.start);
        // attendance (past classes; leave today's unmarked for the mentor demo)
        for (const c of b.classes) {
          if (c.date >= T) continue;
          const recent = c.date > addDays(T, -14);
          const p = P.drop && recent ? 0.2 : P.att;
          const roll = rand();
          const status = roll < p ? (rand() < 0.08 ? 'late' : 'present') : 'absent';
          run('INSERT INTO attendance (class_id, student_id, status, marked_at) VALUES (?,?,?,?)', c.id, sid, status, c.date + ' 21:00:00');
          if (status !== 'absent') xp(sid, status === 'present' ? 10 : 5, 'Attended live class', `att:${c.id}`, c.date + ' 21:00:00');
        }
        // submissions
        for (const a of b.assignments) {
          if (a.due > T && !(a.due <= addDays(T, 4) && rand() < 0.5)) continue; // some early submissions for upcoming
          if (a.type === 'code') continue; // handled via code attempts
          if (rand() > P.sub) continue;
          const late = rand() < (profileKey === 'struggling' ? 0.5 : 0.1);
          const when = addDays(a.due, late ? between(1, 2) : -between(0, 3));
          if (when > T) continue;
          const recentUngraded = a.due >= addDays(T, -4);
          const marks = recentUngraded ? null : Math.round((between(P.marks[0], P.marks[1]) / 100) * a.max);
          const content = a.type === 'project' ? 'Project submitted. Live demo and repo linked below.' : 'Here is my write-up for this assignment. I covered the key concepts discussed in class with examples.';
          const link = a.type === 'project' ? `https://github.com/${first}-dev/cbz-project-${a.id}` : '';
          run('INSERT INTO submissions (assignment_id, student_id, content, link, submitted_at, is_late, marks, feedback, graded_at) VALUES (?,?,?,?,?,?,?,?,?)',
            a.id, sid, content, link, when + ' 18:30:00', late ? 1 : 0, marks, marks === null ? null : pick(['Great work, well structured.', 'Good effort — add more examples next time.', 'Nice! Clean and clear.', 'Please revisit the edge cases.', 'Solid understanding shown.']), marks === null ? null : addDays(when, 1) + ' 10:00:00');
          xp(sid, late ? 10 : 25, late ? 'Submitted assignment (late)' : 'Submitted assignment on time', `sub:${a.id}`, when + ' 18:30:00');
          if (marks !== null && marks / a.max >= 0.8) xp(sid, 15, 'High score bonus', `grade:${a.id}`, addDays(when, 1) + ' 10:00:00');
        }
      }
      // code lab attempts
      let solveCount = isDemo ? 4 : between(P.solve[0], P.solve[1]);
      const W = { easy: 0, medium: 1.2, hard: 2.4 };
      const order = isDemo ? [0, 1, 4, 2] : challengeRows.map((c, i) => ({ i, k: W[c.difficulty] + rand() * 1.5 })).sort((x, y) => x.k - y.k).map((x) => x.i);
      for (let k = 0; k < order.length && k < solveCount + 1; k++) {
        const c = challengeRows[order[k]];
        const tests = JSON.parse(get('SELECT tests FROM challenges WHERE id = ?', c.id).tests).length;
        const solved = k < solveCount;
        const day = addDays(T, -between(1, 30));
        const code = SOLUTIONS[c.function_name] || `// ${c.title}\n// attempt by ${name}\n`;
        if (rand() < 0.5) run('INSERT INTO code_attempts (challenge_id, student_id, code, passed, total, runtime_ms, created_at) VALUES (?,?,?,?,?,?,?)', c.id, sid, code, Math.max(0, tests - between(1, 3)), tests, between(40, 120), day + ' 17:00:00');
        run('INSERT INTO code_attempts (challenge_id, student_id, code, passed, total, runtime_ms, created_at) VALUES (?,?,?,?,?,?,?)', c.id, sid, code, solved ? tests : Math.max(0, tests - 2), tests, between(40, 120), day + ' 17:20:00');
        if (solved) {
          xp(sid, c.xp, `Solved: ${c.title}`, `solve:${c.id}`, day + ' 17:20:00');
          // auto-grade linked code assignments
          for (const bi of bIdx) for (const a of batches[bi].assignments.filter((x) => x.chId === c.id)) {
            run('INSERT OR IGNORE INTO submissions (assignment_id, student_id, content, submitted_at, is_late, marks, feedback, graded_at) VALUES (?,?,?,?,?,?,?,?)',
              a.id, sid, code, day + ' 17:20:00', day > a.due ? 1 : 0, a.max, `Auto-graded: ${tests}/${tests} tests passed`, day + ' 17:20:00');
          }
        }
      }
      // daily check-ins for streak
      const streak = isDemo ? 6 : between(P.streak[0], P.streak[1]);
      const last = isDemo ? addDays(T, -1) : addDays(T, -P.last);
      for (let k = 0; k < streak; k++) xp(sid, 5, 'Daily check-in', `login:${addDays(last, -k)}`, addDays(last, -k) + ' 08:00:00');
      run('UPDATE users SET streak = ?, last_active_date = ? WHERE id = ?', streak, last, sid);

      // fees: 2 instalments per enrolled course
      for (const bi of bIdx) {
        const b = batches[bi];
        const course = COURSES.find((c) => c.code === b.code);
        const half = course.fee / 2;
        const d1 = b.start, d2 = addDays(b.start, 42);
        const paid1 = rand() < Math.min(1, P.pay + 0.3) ? half : rand() < 0.5 ? half / 2 : 0;
        run('INSERT INTO fees (student_id, course_id, title, amount, due_date, paid_amount, paid_at, method) VALUES (?,?,?,?,?,?,?,?)',
          sid, courseIds[b.code], `${course.title} — Instalment 1`, half, d1, paid1, paid1 ? addDays(d1, between(-3, 4)) : null, paid1 ? pick(['UPI', 'Card', 'Net banking', 'UPI']) : null);
        const paid2 = d2 <= addDays(T, 10) && rand() < P.pay * 0.9 ? half : 0;
        run('INSERT INTO fees (student_id, course_id, title, amount, due_date, paid_amount, paid_at, method) VALUES (?,?,?,?,?,?,?,?)',
          sid, courseIds[b.code], `${course.title} — Instalment 2`, half, d2, paid2, paid2 ? (addDays(d2, between(-5, 2)) > T ? T : addDays(d2, between(-5, 2))) : null, paid2 ? pick(['UPI', 'Card', 'EMI']) : null);
      }
    });

    // totals
    db.exec('UPDATE users SET xp = COALESCE((SELECT SUM(points) FROM xp_events x WHERE x.user_id = users.id), 0)');

    // announcements
    const ann = (batchId, author, title, body, daysAgo, pinned = 0) => run('INSERT INTO announcements (batch_id, author_id, title, body, pinned, created_at) VALUES (?,?,?,?,?,?)', batchId, author, title, body, pinned, addDays(T, -daysAgo) + ' 10:00:00');
    ann(null, adminId, 'Placement drive: 12 hiring partners this December', 'Students with a Placement Readiness score of 70+ will be shortlisted for mock interviews next week. Check your readiness report and work on your weakest area.', 1, 1);
    ann(batches[0].id, mentorIds[0], 'Hackathon this Saturday 🏁', 'Build a MERN mini-app in 6 hours. Teams of 2–3. Winners get 200 bonus XP and a CodeBoomz hoodie!', 2);
    ann(batches[1].id, mentorIds[1], 'Spring Boot doubt-clearing session', 'Extra session on Sunday 10 AM for anyone stuck on JPA relationships. Bring your questions.', 3);
    ann(batches[2].id, mentorIds[2], 'Django project deadline extended', 'The REST API mini-project deadline is extended by 2 days. Use the time to add tests.', 4);
    ann(null, adminId, 'Diwali fee offer extended', 'Pay your next instalment before the due date and get 5% cashback on UPI payments.', 9);

    // interventions & a few notifications
    run("INSERT INTO interventions (student_id, mentor_id, action, note, created_at) VALUES ((SELECT id FROM users WHERE email='ishita@student.codeboomz.com'), ?, 'Called student', 'Has exams this month; agreed to watch recordings and submit pending work by Friday.', ?)", mentorIds[0], addDays(T, -3) + ' 18:00:00');

    // silent badge pass, then clear the noise it created and add curated notifications
    for (const st of all("SELECT id FROM users WHERE role='student'")) {
      const stats = I.studentStats(st.id);
      const give = (k) => run('INSERT OR IGNORE INTO badges (user_id, badge, earned_at) VALUES (?,?,?)', st.id, k, addDays(T, -between(1, 20)) + ' 12:00:00');
      if (stats.code.solved >= 1) give('first_solve');
      if (stats.code.solved >= 5) give('coder_5');
      if (stats.activity.streak >= 7) give('streak_7');
      if (stats.attendance.total >= 6 && stats.attendance.absent === 0 && stats.attendance.late === 0) give('never_miss');
      if (stats.assignments.onTime >= 3) give('early_bird');
      if (stats.assignments.graded >= 3 && stats.assignments.avgScorePct >= 85) give('top_scorer');
    }
    db.exec("UPDATE users SET xp = xp + 25 * (SELECT COUNT(*) FROM badges b WHERE b.user_id = users.id) WHERE role='student'");
    const aarav = get("SELECT id FROM users WHERE email='aarav@student.codeboomz.com'").id;
    const note = (uid, title, body, kind, daysAgo) => run('INSERT INTO notifications (user_id, title, body, kind, created_at) VALUES (?,?,?,?,?)', uid, title, body, kind, addDays(T, -daysAgo) + ' 09:00:00');
    note(aarav, 'Graded: Debugging journal', 'You scored 17/20 — Nice! Clean and clear.', 'grade', 2);
    note(aarav, '📣 Hackathon this Saturday 🏁', 'Build a MERN mini-app in 6 hours. Teams of 2–3.', 'announcement', 2);
    note(aarav, 'You are 1 day away from a 7-day streak 🔥', 'Log in tomorrow to unlock the "On Fire" badge.', 'info', 1);
    note(mentorIds[0], 'Ishita Rao flagged as high risk', 'Attendance and submissions dropped this week.', 'risk', 1);
  });
}

if (require.main === module) {
  if (process.argv.includes('--reset')) { wipe(); seed(); console.log('Database reset with demo data.'); }
  else if (get('SELECT id FROM users LIMIT 1')) console.log('Database already has data. Use "npm run reset" to wipe and reseed.');
  else { seed(); console.log('Demo data loaded.'); }
}

module.exports = { seed, wipe };
