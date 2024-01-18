import check, {
  CheckErrorResponse,
  CheckSuccessResponse
} from 'app/_api/horde/check'
import { getPendingJob, updatePendingJobV2 } from '../pendingJobsCache'
import { JobStatus } from '_types'

// There were a number of issues around the AI Horde getting too many 404s
// from ArtBot. Something is happening where jobs aren't being removed
// from the queue. This hack helps mitigate that.
const hacky404JobCheck: { [key: string]: boolean } = {}

export const checkImageJob = async (jobId: string) => {
  const job = getPendingJob(jobId)

  if (hacky404JobCheck[jobId]) {
    return false
  }

  const data: CheckSuccessResponse | CheckErrorResponse = await check(jobId)

  if (data.success) {
    const successData = data as CheckSuccessResponse

    job.done = successData.done
    job.finished = successData.finished
    job.is_possible = successData.is_possible
    job.processing = successData.processing
    job.queue_position = successData.queue_position
    job.wait_time = successData.wait_time
    job.waiting = successData.waiting

    if (job.initWaitTime === null) {
      job.initWaitTime = successData.wait_time
    }

    if (successData.processing > 0) {
      job.jobStatus = JobStatus.Processing
    }

    if (successData.faulted) {
      job.jobStatus = JobStatus.Error
      job.errorMessage =
        'An unknown error occurred while checking pending image job.'
    }

    await updatePendingJobV2(Object.assign({}, job))

    // TODO: Handle "done" state and / or check for existing completed images from within the batch.
  }

  if (!data.success && 'statusCode' in data) {
    if (data.statusCode === 404) {
      hacky404JobCheck[jobId] = true

      await updatePendingJobV2(
        Object.assign({}, job, {
          errorMessage:
            'Job has gone stale and has been removed from the AI Horde backend. Retry?',
          errorStatus: 'NOT_FOUND',
          jobStatus: JobStatus.Error
        })
      )
    }
  }
}