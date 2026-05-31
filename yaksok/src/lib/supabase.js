import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://gaffxiaaeoltjzxyriyv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhZmZ4aWFhZW9pdGp6eHlyaXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTA0MjAsImV4cCI6MjA5NTYyNjQyMH0.e3NFCZzipJA6-1Y-MjBK8gIBhQh2H4EW7vmtKO9J-pY'
);
