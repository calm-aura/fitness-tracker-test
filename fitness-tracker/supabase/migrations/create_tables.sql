-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create workouts table
create table if not exists public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  duration integer not null,
  calories integer not null,
  notes text,
  ai_analysis text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;

-- Create policies
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

create policy "Users can view their own workouts"
  on public.workouts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workouts"
  on public.workouts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workouts"
  on public.workouts
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own workouts"
  on public.workouts
  for delete
  using (auth.uid() = user_id);

-- Create function to handle user profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user(); 