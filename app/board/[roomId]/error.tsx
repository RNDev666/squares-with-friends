"use client";

// Malformed room ids in the URL make the rooms.get query throw before
// the null "Board not found" branch can render — catch it here instead.
export default function BoardError() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      Board not found.
    </main>
  );
}
