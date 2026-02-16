-- VendorHub: run this AFTER the first migration (order_items, notifications, forum, courses)
-- SQL Editor -> New query -> paste -> Run

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order_update', 'promotion', 'draw_result')),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Forum topics
CREATE TABLE IF NOT EXISTS public.forum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view forum topics" ON public.forum_topics;
CREATE POLICY "Authenticated can view forum topics"
  ON public.forum_topics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own forum topics" ON public.forum_topics;
CREATE POLICY "Users can insert own forum topics"
  ON public.forum_topics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Forum replies
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view forum replies" ON public.forum_replies;
CREATE POLICY "Authenticated can view forum replies"
  ON public.forum_replies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert forum replies" ON public.forum_replies;
CREATE POLICY "Users can insert forum replies"
  ON public.forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Course progress
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id, section_id)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own course progress" ON public.course_progress;
CREATE POLICY "Users can view own course progress"
  ON public.course_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own course progress" ON public.course_progress;
CREATE POLICY "Users can insert own course progress"
  ON public.course_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Optional: enable Realtime for forum (run if you want live updates)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_topics;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_replies;
