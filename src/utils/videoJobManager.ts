import fs from 'fs';
import path from 'path';

export interface VideoJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  storyId: string;
  storyTitle: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
  error?: string;
  estimatedTimeRemaining?: number; // in seconds
}

const JOBS_FILE = path.join(process.cwd(), 'temp', 'video-jobs.json');

// Ensure the temp directory exists
function ensureTempDirectory() {
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

// Load jobs from file
function loadJobs(): Record<string, VideoJob> {
  ensureTempDirectory();
  
  if (!fs.existsSync(JOBS_FILE)) {
    return {};
  }
  
  try {
    const data = fs.readFileSync(JOBS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading jobs file:', error);
    return {};
  }
}

// Save jobs to file
function saveJobs(jobs: Record<string, VideoJob>) {
  ensureTempDirectory();
  
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error('Error saving jobs file:', error);
  }
}

// Generate unique job ID
function generateJobId(): string {
  return `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Create a new video job
export function createVideoJob(storyId: string, storyTitle: string): VideoJob {
  const jobs = loadJobs();
  const jobId = generateJobId();
  
  const job: VideoJob = {
    id: jobId,
    status: 'pending',
    progress: 0,
    storyId,
    storyTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  jobs[jobId] = job;
  saveJobs(jobs);
  
  console.log(`Created video job ${jobId} for story "${storyTitle}"`);
  return job;
}

// Update job status
export function updateJobStatus(
  jobId: string, 
  updates: Partial<Pick<VideoJob, 'status' | 'progress' | 'downloadUrl' | 'error' | 'estimatedTimeRemaining'>>
): VideoJob | null {
  const jobs = loadJobs();
  const job = jobs[jobId];
  
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return null;
  }
  
  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  jobs[jobId] = job;
  saveJobs(jobs);
  
  console.log(`Updated job ${jobId}:`, updates);
  return job;
}

// Get job by ID
export function getJob(jobId: string): VideoJob | null {
  const jobs = loadJobs();
  return jobs[jobId] || null;
}

// Get all jobs for a story
export function getJobsForStory(storyId: string): VideoJob[] {
  const jobs = loadJobs();
  return Object.values(jobs).filter(job => job.storyId === storyId);
}

// Clean up old completed jobs (older than 24 hours)
export function cleanupOldJobs(): void {
  const jobs = loadJobs();
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  let cleaned = 0;
  
  for (const [jobId, job] of Object.entries(jobs)) {
    const jobTime = new Date(job.createdAt).getTime();
    if (jobTime < cutoffTime && (job.status === 'completed' || job.status === 'error')) {
      delete jobs[jobId];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    saveJobs(jobs);
    console.log(`Cleaned up ${cleaned} old video jobs`);
  }
}

// Get the latest completed job for a story
export function getLatestCompletedJob(storyId: string): VideoJob | null {
  const jobs = getJobsForStory(storyId);
  const completedJobs = jobs
    .filter(job => job.status === 'completed' && job.downloadUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return completedJobs[0] || null;
}
