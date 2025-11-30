import dynamic from 'next/dynamic'
import { useMemo, useEffect, useRef, useState } from 'react'
import { isBrowser } from '@/lib/utils'

// 导入原始的 Collection 组件
const OriginalCollection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      m => m.Collection
    ),
  { ssr: true }
)

/**
 * 自定义 Collection 组件
 * 检测 map view 并使用 iframe 嵌入 Notion 原生地图视图
 */
const CustomCollection = (props) => {
  const { collectionView, recordMap, block } = props

  // 检测视图类型
  const viewType = useMemo(() => {
    if (!collectionView || !recordMap) {
      if (isBrowser) {
        console.log('[CustomCollection] Missing collectionView or recordMap', { collectionView, recordMap })
      }
      return null
    }
    
    const viewId = Object.keys(collectionView)[0]
    const view = collectionView[viewId]?.value
    
    const detectedType = view?.type || null
    
    // 调试信息
    if (isBrowser && detectedType) {
      console.log('[CustomCollection] View type detected:', detectedType, {
        viewId,
        view,
        allViewTypes: Object.keys(collectionView).map(id => ({
          id,
          type: collectionView[id]?.value?.type
        }))
      })
    }
    
    return detectedType
  }, [collectionView, recordMap])

  // 获取 collection 的 pageId（用于构建 Notion 公开链接）
  const collectionPageId = useMemo(() => {
    // 方法1: 从 props.block 中获取 block ID
    if (block?.id) {
      const pageId = block.id.replace(/-/g, '')
      if (isBrowser) {
        console.log('[CustomCollection] Got pageId from block.id:', pageId)
      }
      return pageId
    }
    
    // 方法2: 从 props 中获取 block ID（如果存在）
    if (props?.blockId) {
      const pageId = props.blockId.replace(/-/g, '')
      if (isBrowser) {
        console.log('[CustomCollection] Got pageId from props.blockId:', pageId)
      }
      return pageId
    }
    
    if (!recordMap?.block) {
      if (isBrowser) {
        console.log('[CustomCollection] No recordMap.block available')
      }
      return null
    }
    
    // 方法3: 查找 collection_view 或 collection_view_page 类型的 block
    const blocks = recordMap.block
    for (const blockId in blocks) {
      const blockValue = blocks[blockId]?.value
      if (blockValue?.type === 'collection_view' || blockValue?.type === 'collection_view_page') {
        const pageId = blockId.replace(/-/g, '')
        if (isBrowser) {
          console.log('[CustomCollection] Got pageId from block search:', pageId, 'block type:', blockValue?.type)
        }
        return pageId
      }
    }
    
    // 方法4: 如果 collection_view_page，尝试从 collectionView 中获取
    if (collectionView) {
      const viewId = Object.keys(collectionView)[0]
      if (viewId) {
        const view = collectionView[viewId]?.value
        if (view?.format?.collection_pointer?.id) {
          const pageId = view.format.collection_pointer.id.replace(/-/g, '')
          if (isBrowser) {
            console.log('[CustomCollection] Got pageId from collection_pointer:', pageId)
          }
          return pageId
        }
      }
    }
    
    if (isBrowser) {
      console.warn('[CustomCollection] Could not find collectionPageId', {
        props: Object.keys(props),
        hasBlock: !!block,
        hasRecordMap: !!recordMap,
        hasCollectionView: !!collectionView
      })
    }
    
    return null
  }, [recordMap, props, collectionView, block])

  // 检测是否为 map view（支持多种可能的类型名称）
  const isMapView = viewType === 'map' || viewType === 'map_view' || viewType === 'map-view'
  
  // 使用 ref 来存储容器元素，用于检测 unsupported view
  const containerRef = useRef(null)
  const [shouldRenderIframe, setShouldRenderIframe] = useState(false)
  
  // 检测原始组件是否显示 "unsupported collection view"
  // 只在没有 collectionView 但有 pageId 的情况下检测
  useEffect(() => {
    if (!isBrowser || !containerRef.current || !collectionPageId || collectionView) return
    
    // 延迟检查，等待原始组件渲染
    const checkUnsupportedView = setTimeout(() => {
      const container = containerRef.current
      if (!container) return
      
      // 检查是否有 "unsupported collection view" 的文本或元素
      const text = container.textContent || ''
      if (text.includes('unsupported') || text.includes('Unsupported')) {
        console.log('[CustomCollection] Detected unsupported view, will render iframe')
        setShouldRenderIframe(true)
      }
    }, 1000)
    
    return () => clearTimeout(checkUnsupportedView)
  }, [isBrowser, collectionPageId, collectionView])

  // 如果是 map view，使用 iframe 嵌入 Notion 页面
  if (isMapView && collectionPageId && isBrowser) {
    // 构建 Notion 公开页面 URL
    // 注意：需要将 Notion 页面设置为公开访问
    const notionPageUrl = `https://www.notion.so/${collectionPageId}`
    
    console.log('[CustomCollection] Rendering map view iframe:', {
      viewType,
      collectionPageId,
      notionPageUrl,
      props: Object.keys(props)
    })
    
    return (
      <div className="notion-map-view-container" style={{ 
        width: '100%', 
        height: '600px',
        margin: '1rem 0',
        border: '1px solid var(--fg-color-1)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <iframe
          src={notionPageUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          allowFullScreen
          title="Notion Map View"
          onLoad={() => {
            console.log('[CustomCollection] Map view iframe loaded successfully')
          }}
          onError={(e) => {
            console.error('[CustomCollection] Map view iframe failed to load:', e)
          }}
        />
      </div>
    )
  }

  // 调试：如果不是 map view，输出信息
  if (isBrowser && viewType) {
    console.log('[CustomCollection] Not a map view, using original component:', {
      viewType,
      isMapView,
      hasCollectionPageId: !!collectionPageId,
      isBrowser
    })
  }

  // 如果检测到 unsupported view，使用 iframe 嵌入
  if (shouldRenderIframe && collectionPageId && isBrowser) {
    console.log('[CustomCollection] Rendering iframe for unsupported view:', collectionPageId)
    return (
      <div className="notion-map-view-container" style={{ 
        width: '100%', 
        height: '600px',
        margin: '1rem 0',
        border: '1px solid var(--fg-color-1)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <iframe
          src={`https://www.notion.so/${collectionPageId}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          allowFullScreen
          title="Notion Map View"
          onLoad={() => {
            console.log('[CustomCollection] Map view iframe loaded successfully')
          }}
          onError={(e) => {
            console.error('[CustomCollection] Map view iframe failed to load:', e)
          }}
        />
      </div>
    )
  }

  // 如果没有 collectionView 但有 pageId，先渲染原始组件并检测
  if (!collectionView && collectionPageId && isBrowser) {
    return (
      <div ref={containerRef}>
        <OriginalCollection {...props} />
      </div>
    )
  }

  // 其他视图类型使用原始组件
  return <OriginalCollection {...props} />
}

export default CustomCollection

