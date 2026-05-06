
-- Add length limits to prevent storage pollution (as highlighted in the security video)

-- Products table
ALTER TABLE public.products
  ADD CONSTRAINT products_name_length CHECK (char_length(name) <= 255),
  ADD CONSTRAINT products_description_length CHECK (char_length(description) <= 5000);

-- Customers table
ALTER TABLE public.customers
  ADD CONSTRAINT customers_name_length CHECK (char_length(name) <= 255),
  ADD CONSTRAINT customers_email_length CHECK (char_length(email) <= 320),
  ADD CONSTRAINT customers_phone_length CHECK (char_length(phone) <= 30),
  ADD CONSTRAINT customers_cpf_length CHECK (char_length(cpf) <= 14);

-- Orders table
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_length CHECK (char_length(payment_method) <= 50),
  ADD CONSTRAINT orders_status_length CHECK (char_length(status) <= 30),
  ADD CONSTRAINT orders_external_id_length CHECK (char_length(external_id) <= 255);

-- Courses table
ALTER TABLE public.courses
  ADD CONSTRAINT courses_title_length CHECK (char_length(title) <= 255),
  ADD CONSTRAINT courses_description_length CHECK (char_length(description) <= 5000);

-- Course modules
ALTER TABLE public.course_modules
  ADD CONSTRAINT course_modules_title_length CHECK (char_length(title) <= 255),
  ADD CONSTRAINT course_modules_description_length CHECK (char_length(description) <= 2000);

-- Course lessons
ALTER TABLE public.course_lessons
  ADD CONSTRAINT course_lessons_title_length CHECK (char_length(title) <= 255),
  ADD CONSTRAINT course_lessons_content_length CHECK (char_length(content) <= 50000);

-- Lesson reviews
ALTER TABLE public.lesson_reviews
  ADD CONSTRAINT lesson_reviews_comment_length CHECK (char_length(comment) <= 2000),
  ADD CONSTRAINT lesson_reviews_customer_name_length CHECK (char_length(customer_name) <= 255);

-- Coupons
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_code_length CHECK (char_length(code) <= 50);

-- Abandoned carts
ALTER TABLE public.abandoned_carts
  ADD CONSTRAINT abandoned_carts_name_length CHECK (char_length(customer_name) <= 255),
  ADD CONSTRAINT abandoned_carts_email_length CHECK (char_length(customer_email) <= 320),
  ADD CONSTRAINT abandoned_carts_phone_length CHECK (char_length(customer_phone) <= 30);

-- Webhook endpoints
ALTER TABLE public.webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_url_length CHECK (char_length(url) <= 2048),
  ADD CONSTRAINT webhook_endpoints_description_length CHECK (char_length(description) <= 500);

-- Custom domains
ALTER TABLE public.custom_domains
  ADD CONSTRAINT custom_domains_hostname_length CHECK (char_length(hostname) <= 255);

-- Fraud blacklist
ALTER TABLE public.fraud_blacklist
  ADD CONSTRAINT fraud_blacklist_value_length CHECK (char_length(value) <= 320),
  ADD CONSTRAINT fraud_blacklist_reason_length CHECK (char_length(reason) <= 500);

-- Profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length CHECK (char_length(full_name) <= 255),
  ADD CONSTRAINT profiles_phone_length CHECK (char_length(phone) <= 30),
  ADD CONSTRAINT profiles_cpf_length CHECK (char_length(cpf) <= 14);
