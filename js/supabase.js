// js/supabase.js
const SUPABASE_URL = "https://kamjqyinhcrbbuxiiavv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbWpxeWluaGNyYmJ1eGlpYXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjE4NzQsImV4cCI6MjA3NjUzNzg3NH0.dbrb4e7BTN-lF99ku8hBkTdjmXZTk0bUiFQVKOr_D2s"; // la de 'anon public'

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
