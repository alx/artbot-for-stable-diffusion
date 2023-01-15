import { DEFAULT_SAMPLER_ARRAY, MAX_IMAGES_PER_JOB } from '../constants'
import CreateImageRequest from '../models/CreateImageRequest'
import RerollImageRequest from '../models/RerollImageRequest'
import { uuidv4 } from './appUtils'
import { db } from './db'
import { randomPropertyName } from './helperUtils'
import { getModelVersion, validModelsArray } from './modelUtils'
import { stylePresets } from './stylePresets'
import { modelInfoStore } from '../store/modelStore'

const cloneImageParams = (
  imageParams: CreateImageRequest | RerollImageRequest
) => {
  const clonedParams = Object.assign({}, imageParams)

  // Create a temporary uuid for easier lookups.
  // Will be replaced later when job is accepted
  // by API
  clonedParams.jobId = uuidv4()
  clonedParams.timestamp = Date.now()

  return clonedParams
}

export const createPendingRerollJob = async (
  imageParams: RerollImageRequest
) => {
  const clonedParams = cloneImageParams(imageParams)

  try {
    await db.pending.add({
      ...clonedParams
    })
  } finally {
    return {
      success: true
    }
  }
}

export const addTriggerToPrompt = ({
  prompt,
  model
}: {
  prompt: string
  model: string
}) => {
  let triggers = ''
  if (modelInfoStore.state.modelDetails[model]) {
    const triggerArray =
      modelInfoStore?.state?.modelDetails[model]?.trigger ?? []

    if (triggerArray.length > 0) {
      triggers = triggerArray.join(' ')
    }
  }

  if (triggers) {
    return `${triggers} ${prompt}`
  }

  return prompt
}

export const createPendingJob = async (imageParams: CreateImageRequest) => {
  const { prompt } = imageParams
  let { numImages = 1 } = imageParams

  if (!prompt || !prompt?.trim()) {
    return []
  }

  if (isNaN(numImages) || numImages < 1 || numImages > MAX_IMAGES_PER_JOB) {
    numImages = 1
  }

  let clonedParams

  if (imageParams.models.length > 1) {
    imageParams.models.forEach(async (model) => {
      clonedParams = cloneImageParams(imageParams)
      clonedParams.models = [model]

      if (
        model === 'stable_diffusion_2.0' ||
        model === 'stable_diffusion_2.1'
      ) {
        clonedParams.sampler = 'dpmsolver'
      }

      try {
        for (let i = 0; i < numImages; i++) {
          if (clonedParams.stylePreset === 'random') {
            clonedParams.stylePreset = randomPropertyName(stylePresets)

            // @ts-ignore
            clonedParams.models = [stylePresets[clonedParams.stylePreset].model]
          }

          if (clonedParams.models[0] === 'random') {
            clonedParams.models = [CreateImageRequest.getRandomModel()]
          }
          clonedParams.modelVersion = getModelVersion(clonedParams.models[0])

          clonedParams.prompt = addTriggerToPrompt({
            prompt,
            model: clonedParams.models[0]
          })

          if (clonedParams.orientation === 'random') {
            clonedParams = {
              ...clonedParams,
              ...CreateImageRequest.getRandomOrientation()
            }
          }

          if (clonedParams.sampler === 'random') {
            clonedParams.sampler = CreateImageRequest.getRandomSampler({
              steps: clonedParams.steps,
              source_processing: clonedParams.source_processing
            })
          }

          db.pending.add({
            ...clonedParams
          })
        }
      } catch (err) {}
    })

    return {
      success: true
    }
  } else if (imageParams.useAllSamplers) {
    imageParams.numImages = 1

    // TODO: Blarg. Should not hard code this. Constants, man. CONSTANTS.
    let samplerArray = [...DEFAULT_SAMPLER_ARRAY]

    if (imageParams.models[0] === 'stable_diffusion_2') {
      samplerArray = ['dpmsolver']
    }

    for (const sampler of samplerArray) {
      clonedParams = cloneImageParams(imageParams)
      clonedParams.sampler = sampler

      if (clonedParams.models[0] === 'random') {
        clonedParams.models = [CreateImageRequest.getRandomModel()]
      }
      clonedParams.modelVersion = getModelVersion(clonedParams.models[0])

      if (clonedParams.orientation === 'random') {
        clonedParams = {
          ...clonedParams,
          ...CreateImageRequest.getRandomOrientation()
        }
      }

      try {
        await db.pending.add({
          ...clonedParams
        })
      } catch (err) {}
    }

    return {
      success: true
    }
  } else if (imageParams.useAllModels) {
    imageParams.numImages = 1
    const models = validModelsArray()

    for (const model of models) {
      const { name: modelName } = model

      // It doesn't make sense to include this in all models mode.
      if (
        modelName === 'stable_diffusion_inpainting' ||
        modelName === 'Stable Diffusion 2 Depth'
      ) {
        return
      }

      clonedParams = cloneImageParams(imageParams)
      clonedParams.models = [modelName]

      if (
        modelName === 'stable_diffusion_2.0' ||
        modelName === 'stable_diffusion_2.1'
      ) {
        clonedParams.sampler = 'dpmsolver'
      }

      if (clonedParams.models[0] === 'random') {
        clonedParams.models = [CreateImageRequest.getRandomModel()]
      }
      clonedParams.modelVersion = getModelVersion(clonedParams.models[0])

      clonedParams.prompt = addTriggerToPrompt({
        prompt,
        model: clonedParams.models[0]
      })

      if (clonedParams.orientation === 'random') {
        clonedParams = {
          ...clonedParams,
          ...CreateImageRequest.getRandomOrientation()
        }
      }

      if (clonedParams.sampler === 'random') {
        clonedParams.sampler = CreateImageRequest.getRandomSampler({
          steps: clonedParams.steps,
          source_processing: clonedParams.source_processing
        })
      }

      try {
        await db.pending.add({
          ...clonedParams
        })
      } catch (err) {}
    }

    return {
      success: true
    }
  } else {
    const count = Array(Number(numImages)).fill(0)

    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    for (const _num of count) {
      clonedParams = cloneImageParams(imageParams)

      if (clonedParams.stylePreset === 'random') {
        clonedParams.stylePreset = randomPropertyName(stylePresets)

        // @ts-ignore
        clonedParams.models = [stylePresets[clonedParams.stylePreset].model]
      }

      if (clonedParams.models[0] === 'random') {
        clonedParams.models = [CreateImageRequest.getRandomModel()]
      }
      clonedParams.modelVersion = getModelVersion(clonedParams.models[0])

      if (clonedParams.orientation === 'random') {
        clonedParams = {
          ...clonedParams,
          ...CreateImageRequest.getRandomOrientation()
        }
      }

      if (clonedParams.sampler === 'random') {
        clonedParams.sampler = CreateImageRequest.getRandomSampler({
          steps: clonedParams.steps,
          source_processing: clonedParams.source_processing
        })
      }

      try {
        await db.pending.add({
          ...clonedParams
        })
      } catch (err) {}
    }

    return {
      success: true
    }
  }
}
