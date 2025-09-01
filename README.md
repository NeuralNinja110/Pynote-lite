# PyNote - Interactive Python Notebook

## Overview

PyNote is a full-stack web application that provides an interactive Python notebook environment similar to Jupyter Notebook. The application allows users to create, edit, and execute Python code in a cell-based interface, manage files, and interact with an AI copilot for assistance. It features a modern React frontend with a Node.js/Express backend, supporting both code execution and AI-powered assistance through multiple providers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Code Editor**: Monaco Editor for syntax highlighting and code editing capabilities

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API structure with route handlers for files, notebook cells, AI services, and Python execution
- **Storage Layer**: Abstracted storage interface with in-memory implementation (easily extendable to database)
- **Python Execution**: Child process spawning for isolated Python code execution in a workspace directory

### Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL with schema definitions
- **Current Implementation**: In-memory storage for development with complete CRUD operations
- **Schema Design**: Separate tables for users, files, notebook cells, copilot sessions, and chat messages
- **Migration Support**: Drizzle Kit for database migrations and schema changes

### Authentication and Authorization
- **Current State**: Basic structure in place with user schema
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **User Model**: Username/password based authentication ready for implementation

### External Service Integrations
- **AI Providers**: 
  - Google Gemini AI integration via `@google/genai` package
  - OpenRouter API support for multiple free AI models including DeepSeek, Qwen, and Meta LLaMA variants
- **Database**: Neon Database serverless PostgreSQL connection
- **Development Tools**: Replit-specific plugins for development environment integration

### Key Architectural Decisions

**Monorepo Structure**: The application uses a shared directory structure with separate client and server folders, plus a shared schema directory for type safety across the full stack.

**Real-time Code Execution**: Python code execution is handled server-side through spawned processes, allowing for safe isolation while maintaining real-time feedback to the frontend.

**Modular AI Integration**: The AI service architecture supports multiple providers through a common interface, making it easy to add new AI providers or switch between them.

**Type Safety**: Full TypeScript implementation with shared types between frontend and backend, using Zod schemas for runtime validation.

**Component Architecture**: React components are organized into feature-based modules (workspace, editor, copilot) with reusable UI components from Shadcn/ui.

**Development Experience**: Hot module replacement via Vite, TypeScript checking, and Replit integration for seamless development workflow.