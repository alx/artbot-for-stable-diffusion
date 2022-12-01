import Head from 'next/head'
import React, { useCallback, useEffect } from 'react'
import { useStore } from 'statery'
import styled from 'styled-components'
import { useRouter } from 'next/router'

import useComponentState from '../hooks/useComponentState'
import { trackEvent } from '../api/telemetry'
import { fetchUserDetails } from '../api/userInfo'
import { Button } from '../components/UI/Button'
import Input from '../components/UI/Input'
import PageTitle from '../components/UI/PageTitle'
import Select from '../components/UI/Select'
import Tooltip from '../components/UI/Tooltip'
import { useEffectOnce } from '../hooks/useEffectOnce'
import {
  IWorkers,
  setWorkers,
  unsetUserInfo,
  userInfoStore
} from '../store/userStore'
import Linker from '../components/UI/Linker'
import Panel from '../components/UI/Panel'
import PointIcon from '../components/icons/PointIcon'
import SpinnerV2 from '../components/Spinner'
import { formatSeconds } from '../utils/helperUtils'

interface IWorkerChange {
  id: string
  name: string
  state: string
  team: string
}

const Section = styled.div`
  padding-top: 16px;

  &:first-child {
    padding-top: 0;
  }
`

const SubSectionTitle = styled.div`
  padding-bottom: 8px;
`

interface MaxWidthProps {
  maxWidth: number
}

const MaxWidth = styled.div<MaxWidthProps>`
  width: 100%;

  ${(props) =>
    props.maxWidth &&
    `
    max-width: ${props.maxWidth}px;
  `}
`

const SettingsWrapper = styled.div`
  width: 100%;

  @media (min-width: 640px) {
    display: flex;
    flex-direction: row;
  }
`

const LinksPanel = styled.div`
  display: none;

  @media (min-width: 640px) {
    border-right: 1px solid white;
    display: flex;
    flex-direction: column;
    width: 280px;
  }
`

const LinksList = styled.ul`
  display: flex;
  flex-direction: column;
  row-gap: 8px;
`

const OptionsPanel = styled.div`
  width: 100%;

  @media (min-width: 640px) {
    display: flex;
    flex-direction: column;
    padding-left: 16px;
  }
`

const WorkerTitle = styled.div`
  column-gap: 2px;
  display: flex;
  flex-direction: row;
  margin-left: -8px;
`

const WorkerId = styled.div`
  font-family: monospace;
  font-size: 14px;
`

const WorkerStatus = styled.div`
  font-size: 14px;
  margin-top: 8px;
`

const SettingsPage = () => {
  const router = useRouter()
  const userStore = useStore(userInfoStore)
  const { worker_ids, workers } = userStore

  const [componentState, setComponentState] = useComponentState({
    apiKey: '',
    panel: 'stableHorde',
    preserveCreate: 'false',
    runBackground: 'false',
    useTrusted: 'true',
    useNsfw: 'false',
    loadingWorkerStatus: {}
  })

  const handleWorkerChange = async (worker: IWorkerChange) => {
    const { id, state, name, team } = worker
    const loadingWorkerStatus = { ...componentState.loadingWorkerStatus }
    loadingWorkerStatus[id] = true

    setComponentState({ loadingWorkerStatus })

    await fetch(`https://stablehorde.net/api/v2/workers/${id}`, {
      body: JSON.stringify({
        maintenance: state === 'pause' ? true : false,
        name,
        team
      }),
      // @ts-ignore
      headers: {
        apikey: componentState.apiKey,
        'Content-Type': 'application/json'
      },
      method: 'PUT'
    })

    const workerRes = await fetch(
      `https://stablehorde.net/api/v2/workers/${id}`
    )
    const data = await workerRes.json()

    console.log(`WORKER DATA`, data)

    loadingWorkerStatus[id] = false
    setComponentState({ loadingWorkerStatus })

    await fetchUserDetails(componentState.apiKey)
  }

  const handleApiInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    localStorage.setItem('apikey', e.target.value)
    setComponentState({ apiKey: e.target.value })
  }

  const handleSaveApiKey = async () => {
    await fetchUserDetails(componentState.apiKey)
  }

  const handlePreserveCreate = (obj: any) => {
    const { value } = obj
    localStorage.setItem('preserveCreateSettings', value)
    setComponentState({ preserveCreate: value })
  }

  const handleRunBackground = (obj: any) => {
    const { value } = obj
    localStorage.setItem('runBackground', value)
    setComponentState({ runBackground: value })
  }

  const handleTrustedSelect = (obj: any) => {
    const { value } = obj
    localStorage.setItem('useTrusted', value)
    setComponentState({ useTrusted: value })
  }

  const handleNsfwSelect = (obj: any) => {
    const { value } = obj
    localStorage.setItem('allowNsfwImages', value)
    setComponentState({ useNsfw: value })
  }

  useEffect(() => {
    if (localStorage.getItem('apikey')) {
      setComponentState({ apiKey: localStorage.getItem('apikey') || '' })
    }

    if (localStorage.getItem('useTrusted') === 'true') {
      setComponentState({
        useTrusted: localStorage.getItem('useTrusted')
      })
    } else {
      setComponentState({
        useTrusted: false
      })
    }

    if (localStorage.getItem('allowNsfwImages') === 'true') {
      setComponentState({
        useNsfw: localStorage.getItem('allowNsfwImages')
      })
    } else {
      setComponentState({
        useNsfw: false
      })
    }

    if (localStorage.getItem('preserveCreateSettings') === 'true') {
      setComponentState({
        preserveCreate: localStorage.getItem('preserveCreateSettings')
      })
    } else {
      setComponentState({
        preserveCreate: false
      })
    }

    if (localStorage.getItem('runBackground') === 'true') {
      setComponentState({
        runBackground: localStorage.getItem('runBackground')
      })
    } else {
      setComponentState({
        runBackground: false
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchWorkerData = useCallback(async () => {
    if (Array.isArray(worker_ids)) {
      let workerInfo: IWorkers = {}

      for (const idx in worker_ids) {
        const workerRes = await fetch(
          `https://stablehorde.net/api/v2/workers/${worker_ids[idx]}`
        )
        const workerData = await workerRes.json()
        const { id } = workerData
        workerInfo[id] = { ...workerData }
      }

      setWorkers(workerInfo)
    }
  }, [worker_ids])

  useEffect(() => {
    if (router.query.panel === 'workers') {
      fetchWorkerData()
    }
  }, [fetchWorkerData, router.query.panel])

  useEffectOnce(() => {
    trackEvent({
      event: 'PAGE_VIEW',
      context: '/pages/settings'
    })
  })

  return (
    <div>
      <Head>
        <title>ArtBot - Settings</title>
      </Head>
      <PageTitle>Settings</PageTitle>
      <SettingsWrapper>
        <LinksPanel>
          <LinksList>
            <li>
              <Linker href="/settings" passHref>
                Stable Horde Settings
              </Linker>
            </li>
            <li>
              <Linker href="/settings?panel=workers" passHref>
                Manage Workers
              </Linker>
            </li>
            <li>
              <Linker href="/settings?panel=pref" passHref>
                ArtBot Preferences
              </Linker>
            </li>
          </LinksList>
        </LinksPanel>
        <OptionsPanel>
          {!router.query.panel ? (
            <>
              <Section>
                <PageTitle as="h2">Stable Horde Settings</PageTitle>
                <SubSectionTitle>
                  API key
                  <Tooltip width="220px">
                    Leave blank for anonymous access. An API key gives higher
                    priority access to the Stable Horde distributed cluster,
                    resulting in shorter image creation times.
                  </Tooltip>
                  <div className="block text-xs mt-2 mb-2 w-full">
                    Leave blank for an anonymous user ID. Register via{' '}
                    <a
                      href="https://stablehorde.net/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-500"
                    >
                      stablehorde.net
                    </a>
                    . Stored in browser using LocalStorage.
                  </div>
                </SubSectionTitle>
                <MaxWidth
                  // @ts-ignore
                  maxWidth="480"
                >
                  {userStore.loggedIn && (
                    <div className="block text-xs mt-2 mb-2 w-full">
                      Logged in as {userStore.username}
                      <br />
                      Kudos:{' '}
                      <span className="text-blue-500">
                        {userStore.kudos?.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <Input
                    type="text"
                    name="steps"
                    onChange={handleApiInput}
                    value={componentState.apiKey}
                  />
                  <div className="flex gap-2 mt-2 justify-start">
                    <Button
                      btnType="secondary"
                      onClick={() => {
                        unsetUserInfo()
                        setComponentState({ apiKey: '' })
                        localStorage.setItem('apikey', '')
                      }}
                    >
                      Log out
                    </Button>
                    <Button
                      onClick={() => {
                        handleSaveApiKey()
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </MaxWidth>
              </Section>
              <Section>
                <SubSectionTitle>
                  Allow NSFW images
                  <div className="block text-xs mt-2 mb-2 w-full">
                    Workers attempt to block NSFW queries. Images flagged by
                    NSFW filter will be blacked out.
                  </div>
                </SubSectionTitle>
                <MaxWidth
                  // @ts-ignore
                  maxWidth="240"
                >
                  <Select
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    onChange={handleNsfwSelect}
                    value={
                      componentState.useNsfw === 'true'
                        ? { value: 'true', label: 'Yes' }
                        : { value: 'false', label: 'No' }
                    }
                  />
                </MaxWidth>
              </Section>
              <Section>
                <SubSectionTitle>
                  Worker type
                  <div className="block text-xs mb-2 mt-2 w-full">
                    Request images from all workers or trusted only. Potential
                    risk if untrusted worker is a troll. Trusted is safer, but
                    potentially slower.
                  </div>
                </SubSectionTitle>
                <MaxWidth
                  // @ts-ignore
                  maxWidth="240"
                >
                  <Select
                    onChange={handleTrustedSelect}
                    options={[
                      { value: 'false', label: 'All Workers' },
                      { value: 'true', label: 'Trusted Only' }
                    ]}
                    value={
                      componentState.useTrusted === 'true'
                        ? { value: 'true', label: 'Trusted Only' }
                        : { value: 'false', label: 'All Workers' }
                    }
                  />
                </MaxWidth>
              </Section>
            </>
          ) : null}
          {router.query.panel === 'workers' ? (
            <>
              <Section>
                <PageTitle as="h2">Manage Workers</PageTitle>
                {componentState.apiKey && worker_ids === null ? (
                  <SpinnerV2 />
                ) : null}
                {componentState.apiKey &&
                Array.isArray(worker_ids) &&
                worker_ids.length === 0 ? (
                  <Section>
                    You currently have no active workers on Stable Horde.
                  </Section>
                ) : null}
                {Object.keys(workers).map((key) => {
                  const worker = workers[key]

                  let statusColor = 'green'
                  if (worker.online && worker.maintenance_mode) {
                    statusColor = 'yellow'
                  } else if (!worker.online) {
                    statusColor = 'red'
                  }

                  return (
                    <Panel key={worker.id}>
                      <WorkerTitle>
                        <PointIcon
                          size={28}
                          fill={statusColor}
                          stroke={statusColor}
                        />
                        <strong>{worker.name}</strong>
                      </WorkerTitle>
                      <WorkerId>id: {worker.id}</WorkerId>
                      <WorkerStatus>
                        <div>
                          Status:{' '}
                          {worker.online && worker.maintenance_mode && 'Paused'}
                          {worker.online &&
                            !worker.maintenance_mode &&
                            'Online'}
                          {!worker.online && 'Offline'}
                        </div>
                        <div>Uptime: {formatSeconds(worker.uptime)}</div>
                        <div>
                          Requests completed:{' '}
                          {worker.requests_fulfilled?.toLocaleString()}
                        </div>
                      </WorkerStatus>
                      <div className="mt-2">
                        {worker.online && !worker.maintenance_mode && (
                          <Button
                            btnType="secondary"
                            disabled={
                              componentState.loadingWorkerStatus[worker.id]
                            }
                            onClick={() => {
                              handleWorkerChange({
                                id: worker.id,
                                state: 'pause',
                                name: worker.name,
                                team: worker.team?.id ?? ''
                              })
                            }}
                          >
                            {componentState.loadingWorkerStatus[worker.id]
                              ? 'Updating...'
                              : 'Pause worker'}
                          </Button>
                        )}
                        {worker.online && worker.maintenance_mode && (
                          <Button
                            disabled={
                              componentState.loadingWorkerStatus[worker.id]
                            }
                            onClick={() => {
                              handleWorkerChange({
                                id: worker.id,
                                state: 'start',
                                name: worker.name,
                                team: worker.team?.id ?? ''
                              })
                            }}
                          >
                            {componentState.loadingWorkerStatus[worker.id]
                              ? 'Updating...'
                              : 'Re-start worker'}
                          </Button>
                        )}
                      </div>
                    </Panel>
                  )
                })}
              </Section>
            </>
          ) : null}
          {router.query.panel === 'pref' ? (
            <>
              <Section>
                <PageTitle as="h2">ArtBot Preferences</PageTitle>
                <SubSectionTitle>
                  Save input on create?
                  <div className="block text-xs mb-2 mt-2 w-full">
                    After clicking &quot;create&quot; on the image generation
                    page, preserve all settings. To remove settings between
                    generations, you will need to click the clear button.
                  </div>
                </SubSectionTitle>
                <MaxWidth
                  // @ts-ignore
                  maxWidth="240"
                >
                  <Select
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    onChange={handlePreserveCreate}
                    value={
                      componentState.preserveCreate === 'true'
                        ? { value: 'true', label: 'Yes' }
                        : { value: 'false', label: 'No' }
                    }
                  />
                </MaxWidth>
              </Section>
              <Section>
                <SubSectionTitle>
                  Run in background?
                  <div className="block text-xs mb-2 mt-2 w-full">
                    By default, ArtBot only runs in the active browser tab in
                    order to try and help prevent your IP address from being
                    throttled. You may disable this behavior if you wish.
                  </div>
                </SubSectionTitle>
                <MaxWidth
                  // @ts-ignore
                  maxWidth="240"
                >
                  <Select
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    onChange={handleRunBackground}
                    value={
                      componentState.runBackground === 'true'
                        ? { value: 'true', label: 'Yes' }
                        : { value: 'false', label: 'No' }
                    }
                  />
                </MaxWidth>
              </Section>
            </>
          ) : null}
        </OptionsPanel>
      </SettingsWrapper>
    </div>
  )
}

export default SettingsPage
