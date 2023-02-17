/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import { useCallback } from 'react'

import { deleteCompletedImage } from '../../../utils/db'
import ConfirmationModal from '../../ConfirmationModal'
import TrashIcon from '../../icons/TrashIcon'
import { Button } from '../../UI/Button'
import { trackEvent, trackGaEvent } from '../../../api/telemetry'
import RefreshIcon from '../../icons/RefreshIcon'
import UploadIcon from '../../icons/UploadIcon'
import {
  copyEditPrompt,
  rerollImage
} from '../../../controllers/imageDetailsCommon'
import Linker from '../../UI/Linker'
import CopyIcon from '../../icons/CopyIcon'
import ImageSquare from '../../ImageSquare'
import { savePrompt, SourceProcessing } from '../../../utils/promptUtils'
import ShareIcon from '../../icons/ShareIcon'
import ShareLinkDetails from '../../../models/ShareableLink'
import DownloadIcon from '../../icons/DownloadIcon'
import useComponentState from '../../../hooks/useComponentState'
import { downloadFile } from '../../../utils/imageUtils'
import AdContainer from '../../AdContainer'
import styles from './imageDetails.module.css'

interface ImageDetails {
  upscaled?: boolean
  img2img?: boolean
  jobId: string
  timestamp: number
  prompt: string
  height: number
  width: number
  cfg_scale: number
  steps?: number
  sampler?: string
  seed: number
  negative?: string
  base64String: string
  denoising_strength?: number
  parentJobId?: string
  model?: string
  modelVersion: string
  imageType?: string
  source_image?: string
  orientation: string
  tiling: boolean
  karras: boolean
  hires: boolean
  clipskip: number
  worker_id?: string
  stylePreset: string
  post_processing: Array<string>
  models: Array<string>
  source_processing: SourceProcessing
}

interface ImageDetailsProps {
  imageDetails: ImageDetails
  onDelete: () => void
}

const ImageDetails = ({
  imageDetails,
  onDelete = () => {}
}: ImageDetailsProps) => {
  const router = useRouter()

  const [componentState, setComponentState] = useComponentState({
    pending: false,
    showDeleteModal: false
  })

  // Older images are missing the correct models field and can cause an exception
  // Check for updated models reference and modify as needed:
  let models = ['stable_diffusion']

  if (imageDetails.models && imageDetails.models[0]) {
    models = [imageDetails.models[0]]
  } else if (!imageDetails.models && imageDetails.model) {
    models = [imageDetails.model]
  }

  imageDetails.models = models

  const handleDeleteImageClick = async (jobId: string) => {
    await deleteCompletedImage(jobId)
    onDelete()
    trackEvent({
      event: 'DELETE_IMAGE',
      context: '/pages/image/[id]'
    })

    setComponentState({ showDeleteModal: false })
  }

  const handleCopyPromptClick = (imageDetails: any) => {
    copyEditPrompt(imageDetails)

    trackEvent({
      event: 'COPY_PROMPT',
      context: '/pages/image/[id]'
    })
    trackGaEvent({
      action: 'btn_delete_img',
      params: {
        context: '/pages/image/[id]'
      }
    })

    router.push(`/?edit=true`)
  }

  const handleRerollClick = useCallback(
    async (imageDetails: any) => {
      if (componentState.pending) {
        return
      }

      setComponentState({ pending: true })

      trackEvent({
        event: 'REROLL_IMAGE_CLICK',
        context: '/pages/image/[id]'
      })

      const reRollStatus = await rerollImage(imageDetails)
      const { success } = reRollStatus

      if (success) {
        trackEvent({
          event: 'REROLL_IMAGE',
          context: '/pages/image/[id]'
        })
        trackGaEvent({
          action: 'btn_reroll',
          params: {
            context: '/pages/image/[id]'
          }
        })
        router.push('/pending')
      }
    },
    [componentState.pending, router, setComponentState]
  )

  const modelName = imageDetails.models[0] || imageDetails.model
  const imageUpscaled =
    imageDetails?.post_processing?.indexOf('RealESRGAN_x4plus') >= 0
  const isImg2Img =
    imageDetails.source_processing === SourceProcessing.Img2Img ||
    imageDetails.img2img

  return (
    <div className="mt-2 text-left">
      {componentState.showDeleteModal && (
        <ConfirmationModal
          onConfirmClick={() => handleDeleteImageClick(imageDetails.jobId)}
          closeModal={() => setComponentState({ showDeleteModal: false })}
        />
      )}
      <div className="pt-2 font-mono">{imageDetails.prompt}</div>
      <div className="font-mono text-xs mt-2 w-full flex flex-row justify-between">
        <div>
          -- Image Details --
          <ul>
            <li>Worker ID: {imageDetails.worker_id}</li>
            <li>
              Job:{' '}
              <Linker
                href={`/job/${imageDetails.parentJobId}`}
                passHref
                className="text-cyan-500"
                onClick={() => {
                  trackEvent({
                    event: 'JOB_DETAILS_CLICK',
                    context: '/pages/image/[id]'
                  })
                }}
              >
                {imageDetails.parentJobId}
              </Linker>
            </li>
            {imageUpscaled && <li>UPSCALED IMAGE</li>}
            {isImg2Img && <li>Source: img2img</li>}
            {imageDetails.negative && (
              <li>Negative prompt: {imageDetails.negative}</li>
            )}
            {imageDetails.stylePreset && (
              <li>Style preset: {imageDetails.stylePreset}</li>
            )}
            <li>
              Height:{' '}
              {imageUpscaled ? imageDetails.height * 4 : imageDetails.height} px
            </li>
            <li>
              Width:{' '}
              {imageUpscaled ? imageDetails.width * 4 : imageDetails.width} px
            </li>
            <li>Sampler: {imageDetails.sampler}</li>
            <li>Karras: {imageDetails.karras ? 'true' : 'false'}</li>
            <li>Hi-res fix: {imageDetails.hires ? 'true' : 'false'}</li>
            <li>
              CLIP skip: {imageDetails.clipskip ? imageDetails.clipskip : 1}
            </li>
            {modelName ? (
              <li>
                Model:{' '}
                <Linker
                  href={`/images?model=${modelName}`}
                  passHref
                  className="text-cyan-500"
                >
                  {modelName}
                </Linker>
              </li>
            ) : null}
            {imageDetails.modelVersion && (
              <li>Model version: {imageDetails.modelVersion}</li>
            )}
            <li>Seed: {imageDetails.seed}</li>
            <li>Steps: {imageDetails.steps}</li>
            <li>cfg scale: {imageDetails.cfg_scale}</li>
            {isImg2Img && imageDetails.denoising_strength && (
              <li>
                Denoise: {Number(imageDetails.denoising_strength).toFixed(2)}
              </li>
            )}
            <li>tiled: {imageDetails.tiling ? 'true' : 'false'}</li>
          </ul>
        </div>
        {!imageDetails.source_image && (
          <div className="max-w-[200px] pl-[16px] items-start">
            <AdContainer minSize={0} maxSize={1400} />
          </div>
        )}
        {imageDetails.source_image && (
          <div>
            <div className="mb-2">img2img source:</div>
            <div className="relative">
              <ImageSquare
                imageDetails={{ base64String: imageDetails.source_image }}
                imageType={imageDetails.imageType}
                size={120}
              />
              <div
                className="absolute top-0 right-0 bg-blue-500 cursor-pointer p-[1px]"
                onClick={() => {
                  trackEvent({
                    event: 'NEW_PROMPT_FROM_ORIGINAL_IMG2IMG_SRC',
                    context: '/pages/image/[id]'
                  })

                  savePrompt({
                    img2img: true,
                    imageType: imageDetails.imageType,
                    prompt: imageDetails.prompt,
                    sampler: imageDetails.sampler,
                    steps: imageDetails.steps,
                    tiling: imageDetails.tiling,
                    orientation: imageDetails.orientation,
                    height: imageDetails.height,
                    width: imageDetails.width,
                    cfg_scale: imageDetails.cfg_scale,
                    parentJobId: imageDetails.parentJobId,
                    negative: imageDetails.negative,
                    source_image: imageDetails.source_image,
                    source_processing: SourceProcessing.Img2Img,
                    denoising_strength: imageDetails.denoising_strength,
                    models: imageDetails?.models[0]
                      ? imageDetails.models
                      : [imageDetails.model || 'stable_diffusion']
                  })
                  router.push(`/?panel=img2img&edit=true`)
                }}
              >
                <UploadIcon />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-xs mt-2">
        Created: {new Date(imageDetails.timestamp).toLocaleString()}
      </div>
      <div className="mt-2 w-full flex flex-row">
        <div className="inline-block w-3/4 flex flex-row gap-2">
          <Button
            title="Copy and re-edit prompt"
            // @ts-ignore
            onClick={() => handleCopyPromptClick(imageDetails)}
          >
            <CopyIcon />
            <span className="inline-block md:hidden">Copy</span>
            <span className="hidden md:inline-block">Copy prompt</span>
          </Button>
          <Button
            title="Share link"
            onClick={() => {
              // DEV NOTE: Copy to clipboard does not work on non-https links.
              // @ts-ignore
              const shareLink = ShareLinkDetails.encode(imageDetails)
              const hostname =
                window.location.hostname === 'localhost'
                  ? 'http://localhost:3000'
                  : 'https://tinybots.net'
              navigator?.clipboard
                ?.writeText(`${hostname}/artbot?share=${shareLink}`)
                .then(() => {
                  toast.success('URL copied!', {
                    pauseOnFocusLoss: false,
                    position: 'top-center',
                    autoClose: 2500,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: false,
                    draggable: false,
                    progress: undefined,
                    theme: 'light'
                  })
                })
            }}
          >
            <ShareIcon />
            <span className="inline-block md:hidden">Share</span>
            <span className="hidden md:inline-block">Share link</span>
          </Button>
          <Button
            title="Download PNG"
            // @ts-ignore
            onClick={() => downloadFile(imageDetails)}
          >
            <DownloadIcon />
            <span className="hidden md:inline-block">Download PNG</span>
          </Button>
        </div>
        <div className="w-1/2 flex flex-row justify-end gap-2">
          <Button
            title="Request new image with same settings"
            onClick={() => handleRerollClick(imageDetails)}
            disabled={componentState.pending}
          >
            <RefreshIcon className="mx-auto" />
            <span className={styles['mobile-hide-text']}>Reroll Image</span>
          </Button>
          <Button
            title="Delete image"
            btnType="secondary"
            onClick={() => setComponentState({ showDeleteModal: true })}
          >
            <TrashIcon className="mx-auto" />
            <span className={styles['mobile-hide-text']}>Delete image</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ImageDetails