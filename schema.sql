-- Workians LMS - Multi-Tenant Database Schema
-- No ORM used. Raw SQL for Node.js (mysql2).

-- Hostinger DB already created usually, so no need for CREATE DATABASE
USE u402629099_LMSWorkians;

-- 1. BUSINESSES
CREATE TABLE businesses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    call_recording_enabled TINYINT(1) DEFAULT 1,
    store_all_employee_calls TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. ROLES
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE -- CEO, Admin, Instructor, Student
);

-- Insert Default Roles
INSERT INTO roles (name) VALUES ('CEO'), ('Admin'), ('Instructor'), ('Student') ON DUPLICATE KEY UPDATE name=name;

-- 3. USERS
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT DEFAULT NULL,
    role_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    call_access_scope ENUM('lead_call_records','all_call_records') NOT NULL DEFAULT 'lead_call_records',
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    UNIQUE KEY unique_business_email (business_id, email),
    INDEX idx_business_role (business_id, role_id)
);

-- 4. COURSES
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    instructor_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0.00,
    delivery_mode ENUM('Live','Recorded') DEFAULT 'Recorded',
    recorded_type VARCHAR(120) DEFAULT NULL,
    pricing_type VARCHAR(80) DEFAULT 'Paid',
    free_for_members BOOLEAN DEFAULT FALSE,
    course_type VARCHAR(80) DEFAULT 'Chapter Wise Course',
    thumbnail_url VARCHAR(512),
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_org_course (org_id, id)
);

-- 5. MODULES
CREATE TABLE modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    sequence_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_course_order (course_id, sequence_order)
);

-- 6. LESSONS
CREATE TABLE lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    module_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_type ENUM('video', 'pdf', 'text') NOT NULL,
    content_url VARCHAR(512), -- S3 Key or URL
    text_content MEDIUMTEXT,
    sequence_order INT NOT NULL DEFAULT 0,
    is_preview BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    INDEX idx_module_order (module_id, sequence_order)
);

-- 7. ENROLLMENTS
CREATE TABLE enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_course (student_id, course_id)
);

-- 8. SUBSCRIPTIONS (For Plans)
CREATE TABLE subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    user_id INT NOT NULL,
    plan_type ENUM('monthly', 'yearly') NOT NULL,
    status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. PAYMENTS (Razorpay)
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    status ENUM('pending', 'successful', 'failed') DEFAULT 'pending',
    payment_method VARCHAR(50),
    item_type ENUM('course', 'subscription') NOT NULL,
    item_id INT NOT NULL, -- references course_id or subscription_id logically
    platform_fee DECIMAL(10,2) DEFAULT 0.00,
    instructor_earning DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. QUIZZES
CREATE TABLE quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    module_id INT NULL, -- Can be attached to course generally or specifically to a module
    title VARCHAR(255) NOT NULL,
    passing_percentage DECIMAL(5,2) DEFAULT 40.00,
    time_limit_minutes INT DEFAULT 0, -- 0 means no limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL
);

-- 11. QUESTIONS
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    quiz_id INT NOT NULL,
    question_text TEXT NOT NULL,
    marks INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- 12. OPTIONS
CREATE TABLE options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    question_id INT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- 13. QUIZ ATTEMPTS
CREATE TABLE quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    student_id INT NOT NULL,
    quiz_id INT NOT NULL,
    score DECIMAL(5,2) DEFAULT 0.00,
    is_passed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- 14. CERTIFICATES
CREATE TABLE certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    certificate_url VARCHAR(512) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cert (student_id, course_id)
);

-- 15. PAYOUTS
CREATE TABLE payouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    instructor_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'paid', 'failed') DEFAULT 'pending',
    razorpay_payout_id VARCHAR(255),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 16. PROGRESS TRACKING
CREATE TABLE progress_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    student_id INT NOT NULL,
    lesson_id INT NOT NULL,
    status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
    watch_time_seconds INT DEFAULT 0,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE KEY unique_progress (student_id, lesson_id),
    INDEX idx_student_status (student_id, status)
);

-- 17. COURSE VIDEOS
CREATE TABLE course_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(1024) NOT NULL,
    thumbnail_url VARCHAR(1024) DEFAULT NULL,
    assigned_trainer_id INT DEFAULT NULL,
    assigned_trainer_name VARCHAR(255) DEFAULT NULL,
    uploader_id INT DEFAULT NULL,
    uploader_role VARCHAR(50) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_course_videos_org_course (org_id, course_id)
);

-- 18. COURSE VIDEO LIKES
CREATE TABLE course_video_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    video_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_course_video_like (org_id, course_id, video_id, user_id),
    INDEX idx_course_video_likes_video (org_id, course_id, video_id),
    FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
);

-- 19. COURSE VIDEO COMMENTS
CREATE TABLE course_video_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    video_id INT NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(255) DEFAULT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_course_video_comments_video (org_id, course_id, video_id, created_at),
    FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
);

-- 20. COURSE VIDEO PROGRESS (Student Watch Tracking)
CREATE TABLE course_video_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    video_id INT NOT NULL,
    user_id INT NOT NULL,
    watch_time_seconds INT NOT NULL DEFAULT 0,
    status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_course_video_progress (org_id, course_id, video_id, user_id),
    INDEX idx_course_video_progress_video (org_id, course_id, video_id),
    FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
);

-- 21. COURSE VIDEO COMMENT REACTIONS (Like/Dislike on comments)
CREATE TABLE course_video_comment_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    video_id INT NOT NULL,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,
    reaction ENUM('like', 'dislike') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_comment_user_reaction (org_id, course_id, comment_id, user_id),
    INDEX idx_comment_reactions_comment (org_id, course_id, comment_id),
    FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES course_video_comments(id) ON DELETE CASCADE
);

-- 22. COURSE BOOKMARKS (Student saved courses)
CREATE TABLE course_bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_course_bookmark (org_id, course_id, user_id),
    INDEX idx_course_bookmarks_user (org_id, user_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 23. COURSE MEDIA BOOKMARKS (Student saved media files)
CREATE TABLE course_media_bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    course_id INT NOT NULL,
    video_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_course_media_bookmark (org_id, course_id, video_id, user_id),
    INDEX idx_course_media_bookmarks_user (org_id, user_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
);
