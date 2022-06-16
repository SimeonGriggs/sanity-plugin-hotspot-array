/* eslint-disable react/display-name */

// @ts-ignore
import sanityClient from 'part:@sanity/base/client'
// @ts-ignore
import {withDocument} from 'part:@sanity/form-builder'

import {getImageDimensions} from '@sanity/asset-utils'
import {FormBuilderInput} from '@sanity/form-builder/lib/FormBuilderInput'
import {insert, PatchEvent, set, setIfMissing} from '@sanity/form-builder/PatchEvent'
import imageUrlBuilder from '@sanity/image-url'
import {Card, Flex, Stack} from '@sanity/ui'
import {randomKey} from '@sanity/util/content'
import get from 'lodash/get'
import React, {useState} from 'react'

import {IUseResizeObserverCallback, useDebouncedCallback, useResizeObserver} from '@react-hookz/web'
import Feedback from './Feedback'
import Spot from './Spot'
import {useUnsetInputComponent} from './useUnsetInputComponent'

const imageStyle = {width: `100%`, height: `auto`}

const VALID_ROOT_PATHS = ['document', 'parent']

export type FnHotspotMove = (key: string, x: number, y: number) => void

export type TSpot = {
  _key: string
  _type: `spot`
  x: number
  y: number
} & {[key: string]: unknown}

const HotspotArray = React.forwardRef((props: any, ref) => {
  const {type, value, onChange, document} = props
  const {options} = type ?? {}

  // Attempt prevention of infinite loop in <FormBuilderInput />
  // Re-renders can still occur if this Component is used again in a nested field
  const typeWithoutInputComponent = useUnsetInputComponent(type, type?.inputComponent)
  const imageHotspotPathRoot = VALID_ROOT_PATHS.includes(options?.imageHotspotPathRoot)
    ? props[options.imageHotspotPathRoot]
    : document

  /**
   * Finding the image from the imageHotspotPathRoot (defaults to document),
   * using the path from the hotspot's `options` field
   *
   * when changes in imageHotspotPathRoot (e.g. document) occur,
   * check if there are any changes to the hotspotImage and update the reference
   */
  const hotspotImage = React.useMemo(() => {
    return get(imageHotspotPathRoot, options?.hotspotImagePath)
  }, [imageHotspotPathRoot])

  const displayImage = React.useMemo(() => {
    const builder = imageUrlBuilder(sanityClient).dataset(sanityClient.config().dataset)
    const urlFor = (source) => builder.image(source)

    if (hotspotImage?.asset?._ref) {
      const {aspectRatio} = getImageDimensions(hotspotImage.asset._ref)
      const width = 600
      const height = Math.round(width / aspectRatio)
      const url = urlFor(hotspotImage).width(width).url()

      return {width, height, url}
    }

    return null
  }, [hotspotImage])

  const handleHotspotImageClick = React.useCallback((event) => {
    const {nativeEvent} = event

    // Calculate the x/y percentage of the click position
    const x = Number(((nativeEvent.offsetX * 100) / nativeEvent.srcElement.width).toFixed(2))
    const y = Number(((nativeEvent.offsetY * 100) / nativeEvent.srcElement.height).toFixed(2))
    const description = `New Hotspot at ${x}% x ${y}%`

    const newRow: TSpot = {
      _key: randomKey(12),
      _type: `spot`,
      x,
      y,
    }

    if (options?.hotspotDescriptionPath) {
      newRow[options.hotspotDescriptionPath] = description
    }

    onChange(PatchEvent.from(setIfMissing([]), insert([newRow], 'after', [-1])))
  }, [])

  const handleHotspotMove: FnHotspotMove = React.useCallback(
    (key, x, y) => {
      onChange(
        PatchEvent.from(
          // Set the `x` value of this array key item
          set(x, [{_key: key}, 'x']),
          // Set the `y` value of this array key item
          set(y, [{_key: key}, 'y'])
        )
      )
    },
    [value]
  )

  const hotspotImageRef = React.useRef<HTMLImageElement | null>(null)

  const [imageRect, setImageRect] = useState<DOMRectReadOnly>()
  const updateImageRectCallback = useDebouncedCallback(
    ((e) => setImageRect(e.contentRect)) as IUseResizeObserverCallback,
    [setImageRect],
    200
  )
  useResizeObserver(hotspotImageRef, updateImageRectCallback)

  return (
    <Stack space={[2, 2, 3]}>
      {displayImage?.url ? (
        <div style={{position: `relative`}}>
          {imageRect &&
            value?.length > 0 &&
            value.map((spot) => (
              <Spot
                key={spot._key}
                spot={spot}
                bounds={imageRect}
                update={handleHotspotMove}
                hotspotDescriptionPath={options?.hotspotDescriptionPath}
                tooltip={options?.hotspotTooltip}
              />
            ))}

          <Card __unstable_checkered shadow={1}>
            <Flex align="center" justify="center">
              <img
                ref={hotspotImageRef}
                src={displayImage.url}
                width={displayImage.width}
                height={displayImage.height}
                alt=""
                style={imageStyle}
                onClick={handleHotspotImageClick}
              />
            </Flex>
          </Card>
        </div>
      ) : (
        <Feedback>
          {type?.options?.hotspotImagePath ? (
            <>
              No Hotspot image found at path <code>{type?.options?.hotspotImagePath}</code>
            </>
          ) : (
            <>
              Define a path in this field using to the image field in this document at{' '}
              <code>options.hotspotImagePath</code>
            </>
          )}
        </Feedback>
      )}
      {type?.options?.imageHotspotPathRoot &&
        !VALID_ROOT_PATHS.includes(type.options.imageHotspotPathRoot) && (
          <Feedback>
            The supplied imageHotspotPathRoot "{type.options.imageHotspotPathRoot}" is not valid,
            falling back to "document". Available values are "{VALID_ROOT_PATHS.join(', ')}".
          </Feedback>
        )}
      <FormBuilderInput {...props} type={typeWithoutInputComponent} ref={ref} />
    </Stack>
  )
})

export default withDocument(HotspotArray)
