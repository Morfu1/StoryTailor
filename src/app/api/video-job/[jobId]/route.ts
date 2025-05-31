import { NextResponse } from 'next/server';
import { getJob, updateJobStatus } from '@/utils/videoJobManager';
import { activeRenderProcesses } from '@/app/api/render-video/route'; // Import the map

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    const job = getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(job);
  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if the job is currently processing
    if (job.status !== 'processing' && job.status !== 'pending') {
      return NextResponse.json(
        { error: 'Job is not currently rendering or pending, cannot cancel.' },
        { status: 400 }
      );
    }

    const childProcess = activeRenderProcesses.get(jobId);

    if (childProcess && !childProcess.killed) {
      console.log(`Attempting to kill process for job ${jobId} with PID: ${childProcess.pid}`);
      const killed = childProcess.kill('SIGTERM'); // Send SIGTERM to allow graceful shutdown
      if (killed) {
        console.log(`Successfully sent SIGTERM to process for job ${jobId}`);
        activeRenderProcesses.delete(jobId);
        updateJobStatus(jobId, { status: 'error', error: 'Render cancelled by user.', progress: job.progress });
        return NextResponse.json({ message: 'Video rendering cancellation initiated.' });
      } else {
        console.error(`Failed to send SIGTERM to process for job ${jobId}. It might have already exited.`);
        // Attempt to update status anyway, as the process might be defunct
        updateJobStatus(jobId, { status: 'error', error: 'Failed to cancel render (process might have already exited).', progress: job.progress });
        activeRenderProcesses.delete(jobId); // Clean up map entry
        return NextResponse.json({ error: 'Failed to signal the rendering process. It may have already exited.' }, { status: 500 });
      }
    } else {
      console.log(`No active rendering process found for job ${jobId} or already killed. Updating status.`);
      // If no process is found, it might have finished or errored out between checks.
      // Or it's pending and hasn't started a child process yet.
      // Update status to reflect cancellation attempt.
      updateJobStatus(jobId, { status: 'error', error: 'Render cancelled by user (process not found or already stopped).', progress: job.progress });
      activeRenderProcesses.delete(jobId); // Clean up map entry if it exists
      return NextResponse.json({ message: 'No active rendering process to cancel, or already stopped. Marked as cancelled.' });
    }

  } catch (error) {
    console.error('Error cancelling job:', error);
    const { jobId } = await params;
    if (jobId) {
       updateJobStatus(jobId, { status: 'error', error: 'Error during cancellation process.' });
    }
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
