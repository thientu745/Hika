# Hika

## Getting Started

### 1. Setup Environment
```bash
git clone https://github.com/thientu745/Hika.git
cd <your-repo-name>
```

### 2. Install Dependencies
```bash
cd HikaApp
npm install
```

### 3. Building Locally
```bash
cd HikaApp
npx expo start
```

## Branching & Workflow
This project follows a structured branching strategy to ensure efficient collaboration and workflow:

### Branch Types
1. **`main`**: Long-running branch for production-ready code.  
2. **`feat/[topic-name]`**: Feature-specific branches created from `main`. Use for implementing features or fixes.  
3. **`feat/[topic-name]-topic/[subtopic-name]`**: Sub-branches for collaboration on feature parts. Created from `feat/[topic-name]`.  

### Workflow
Follow these steps for new development:
1. **Sync with `main`**: Make sure you local `main` branch is up-to-date before starting any new work.
	```bash
	git checkout main
	git pull origin main
	```
2. **Create your branch**: Create your new branch from the `main` branch.
	```bash
	git checkout -b feat/[topic-name]
	```
3. **Make changes**: Make necessary changes and commit them with clear and descriptive commit messages.
4. **Push your branch**: Upload your branch to the remote repository
	```bash
	git push -u origin feat/[topic-name]
	```
5. **Open a Pull Request**: Go to the repository’s GitHub page and open a new Pull Request to merge your branch into `main`.
6. **Review**: Your PR must be reviewed and approved by at least one other team member.
7. **Merge**: Once approved, your branch will be merged into `main`.





