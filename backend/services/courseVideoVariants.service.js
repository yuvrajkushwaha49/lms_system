const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const db = require('../config/db');

const VIDEO_VARIANTS = [
  { resolution: '360p', height: 360 },
  { resolution: '720p', height: 720 },
  { resolution: '1080p', height: 1080 },
];

const ensureCourseVideoVariantsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_video_variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      resolution VARCHAR(20) NOT NULL,
      status ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'pending',
      media_url VARCHAR(1024) DEFAULT NULL,
      error_message VARCHAR(1000) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_video_variant (video_id, resolution),
      INDEX idx_course_video_variants_lookup (org_id, course_id, video_id),
      CONSTRAINT fk_course_video_variants_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const runFfmpegVariant = (inputPath, outputPath, height) =>
  new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `scale=-2:${height}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `FFmpeg exited with code ${code}`));
    });
  });

const updateCourseVideoProcessingStatus = async (videoId) => {
  const [rows] = await db.query(
    `SELECT
      SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
     FROM course_video_variants
     WHERE video_id = ?`,
    [videoId],
  );
  const processingCount = Number(rows[0]?.processing_count || 0);
  const failedCount = Number(rows[0]?.failed_count || 0);
  if (processingCount === 0) {
    await db.query('UPDATE course_videos SET processing_status = ? WHERE id = ?', [
      failedCount > 0 ? 'failed' : 'ready',
      videoId,
    ]);
  }
};

/**
 * Same pattern as Sell It Snacks: parallel MP4 renditions under uploads/course-media/video-variants/<videoId>/
 */
const processCourseVideoVariants = async ({ resolveMediaUrl, orgId, courseId, videoId, inputPath }) => {
  await ensureCourseVideoVariantsTable();
  if (!ffmpegPath) {
    await db.query(
      "UPDATE course_video_variants SET status = 'failed', error_message = ? WHERE video_id = ?",
      ['FFmpeg binary is not available.', videoId],
    );
    await updateCourseVideoProcessingStatus(videoId);
    return;
  }

  const variantDir = path.join(__dirname, '..', 'uploads', 'course-media', 'video-variants', String(videoId));
  fs.mkdirSync(variantDir, { recursive: true });

  await Promise.all(
    VIDEO_VARIANTS.map(async (variant) => {
      const outputFilename = `${variant.resolution}.mp4`;
      const outputPath = path.join(variantDir, outputFilename);
      const relativeKey = `video-variants/${videoId}/${outputFilename}`;
      const mediaUrl = resolveMediaUrl(relativeKey);
      try {
        await db.query(
          "UPDATE course_video_variants SET status = 'processing', error_message = NULL WHERE video_id = ? AND resolution = ?",
          [videoId, variant.resolution],
        );
        await runFfmpegVariant(inputPath, outputPath, variant.height);
        await db.query(
          "UPDATE course_video_variants SET status = 'ready', media_url = ?, error_message = NULL WHERE video_id = ? AND resolution = ?",
          [mediaUrl, videoId, variant.resolution],
        );
      } catch (error) {
        await db.query(
          "UPDATE course_video_variants SET status = 'failed', error_message = ? WHERE video_id = ? AND resolution = ?",
          [String(error.message || error).slice(0, 1000), videoId, variant.resolution],
        );
      }
    }),
  );
  await updateCourseVideoProcessingStatus(videoId);
};

function resolveLocalCourseUploadPath(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  let pathname = '';
  try {
    if (/^https?:\/\//i.test(videoUrl)) {
      pathname = new URL(videoUrl).pathname;
    } else if (videoUrl.startsWith('/')) {
      pathname = videoUrl.split(/[?#]/)[0];
    } else {
      return null;
    }
  } catch {
    return null;
  }
  const marker = '/uploads/course-media/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const relative = pathname.slice(idx + marker.length);
  if (!relative || relative.includes('..')) return null;
  if (/\.m3u8$/i.test(relative)) return null;
  const base = path.join(__dirname, '..', 'uploads', 'course-media');
  const abs = path.join(base, ...relative.split('/'));
  const normalizedBase = path.normalize(base);
  const normalizedAbs = path.normalize(abs);
  if (!normalizedAbs.startsWith(normalizedBase)) return null;
  return normalizedAbs;
}

module.exports = {
  VIDEO_VARIANTS,
  ensureCourseVideoVariantsTable,
  processCourseVideoVariants,
  updateCourseVideoProcessingStatus,
  resolveLocalCourseUploadPath,
};
