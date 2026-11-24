# CodeBoomz LMS

A modern learning management system for [CodeBoomz](https://codeboomz.com). It covers batches, live classes, attendance, assignments, fees and announcements, and adds four features built for a coding institute:

| Feature | What it does |
| --- | --- |
| 💻 **Code Lab** | Students write JavaScript or Python in the browser and run it against sample tests. On submit, hidden tests run too. Passing tests auto-grade any linked "Code Lab" assignment and award XP. Mentors can add new challenges with JSON test cases. |
| 📡 **At-Risk Radar** | Every student gets a live 0–100 risk score from attendance (including sudden drops), missing work, low scores, inactivity and overdue fees. Each signal comes with a suggested action. Mentors can send a nudge (in-app message) and the intervention is logged. |
| 🎯 **Placement Readiness** | A single job-readiness score that weights coding 35%, assignments 25%, attendance 15%, projects 15% and consistency 10%, plus the student's next three best steps. |
| 🔥 **Streaks, XP & Badges** | XP for attending, submitting on time, high scores, solving challenges and daily check-ins. It also has levels, streaks, six badges and an all-time or weekly leaderboard by batch. |

Roles:

- **Admin:** institute dashboard, revenue, students, mentors, courses and batches, fees and payments, announcements and the Radar.
- **Mentor:** today's classes, one-tap attendance, grading queue, assignments, Code Lab and the Radar for their own batches.
- **Student:** dashboard, classes with join links, assignments, Code Lab, readiness, attendance, fees and leaderboard.

## Run it

Needs **Node.js 22.13 or newer** and no `npm install`, because there are zero dependencies. It uses Node's built-in `node:sqlite`. Python 3 is only needed for Python challenges in the Code Lab.

```bash
cd codeboomz-lms
npm start            # http://localhost:3000  (PORT=4000 npm start to change)
```

The first start creates `data/codeboomz.sqlite` with realistic demo data. The dates are relative to today, so the demo always looks live.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@codeboomz.com | demo123 |
| Mentor | priya@codeboomz.com | demo123 |
| Student | aarav@student.codeboomz.com | demo123 |

The login page also has one-click demo buttons. Every other seeded student follows the pattern `firstname@student.codeboomz.com` with password `demo123`.

Other scripts:

```bash
npm run reset   # wipe the database and reload demo data
npm run dev     # restart automatically on file changes
```

## Project structure

```
codeboomz-lms/
├── server/
│   ├── index.js      # HTTP server, router, static files
│   ├── api.js        # all REST endpoints + role/batch access checks
│   ├── insights.js   # risk score, readiness score, XP, streaks, badges, leaderboard
│   ├── runner.js     # Code Lab runner (separate time-limited process per run)
│   ├── db.js         # SQLite schema (node:sqlite)
│   ├── auth.js       # scrypt password hashing + session tokens
│   ├── seed.js       # demo data
│   └── util.js
└── public/           # vanilla JS single-page app (no build step)
    ├── index.html
    ├── css/app.css   # design system, light + dark themes, responsive
    └── js/
        ├── app.js    # shell, login, routing, notifications
        ├── api.js, ui.js
        └── pages/    # dashboards, people, academics, codelab, growth
```

## Notes for production

- **Code execution:** the Code Lab runs each submission in a separate process with a time and memory limit. That is fine for local and internal use. On a public server, run it inside a real sandbox such as Docker, Judge0 or Firecracker.
- **Payments:** fees are recorded by the admin. There is no payment gateway yet; Razorpay is the natural next step.
- **Live classes:** these use meeting links (Google Meet, Zoom). Recordings are stored as links.
- Put the server behind HTTPS, such as Nginx or Caddy, and back up the `data/` folder.
