# a11y-checker

A lightweight Figma plugin built with TypeScript that checks color contrast and validates UI designs against WCAG accessibility standards directly within your design workflow.

---

## Features

- **Real-Time Contrast Calculation:** Automatically computes color contrast ratios between selected foreground and background layers.
- **WCAG Compliance Validation:** Evaluates UI elements against WCAG 2.1 AA and AAA thresholds for normal and large text.
- **Instant Design Feedback:** Helps designers and developers catch accessibility issues before developer handoff.

---

## Tech Stack

- **Core Logic:** TypeScript, Figma Plugin API
- **User Interface:** HTML5, CSS3
- **Build Tools:** Node.js, npm

---

## Local Development Setup

Follow these steps to run and modify the plugin locally in the Figma Desktop app:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (which includes `npm`) and the [Figma Desktop App](https://www.figma.com/downloads/) installed.

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/edisonagamba/a11y-checker.git
cd a11y-checker
npm install
