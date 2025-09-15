import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rnlnomhgtscmdqqyyyyz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubG5vbWhndHNjbWRxcXl5eXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MDMwMTYsImV4cCI6MjA3MzQ3OTAxNn0.iEdqe3gmo4ANUcJDZttbNOna7llWyrHrlCl3k0rfXSc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);