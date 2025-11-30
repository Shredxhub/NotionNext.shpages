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
  
  const [shouldRenderIframe, setShouldRenderIframe] = useState(false)
  const containerRef = useRef(null)
  const observerRef = useRef(null)
  const fallbackTimerRef = useRef(null)
  
  // 使用 MutationObserver 监听 DOM 变化，检测 unsupported view
  useEffect(() => {
    if (!isBrowser || !collectionPageId || collectionView) return
    if (shouldRenderIframe) return // 如果已经决定渲染 iframe，不再监听
    
    const container = containerRef.current
    if (!container) return
    
    console.log('[CustomCollection] Setting up MutationObserver for unsupported view detection')
    
    // 检查函数
    const checkForUnsupported = (target) => {
      if (!target) return false
      
      // 检查文本内容
      const text = target.textContent || ''
      if (text.includes('unsupported') || text.includes('Unsupported')) {
        console.log('[CustomCollection] Detected unsupported view in DOM:', text.substring(0, 100))
        return true
      }
      
      // 检查是否有特定的类名或属性
      if (target.classList) {
        const classList = Array.from(target.classList)
        if (classList.some(cls => cls.includes('unsupported') || cls.includes('error'))) {
          console.log('[CustomCollection] Detected unsupported view via class:', classList)
          return true
        }
      }
      
      return false
    }
    
    // 创建 MutationObserver
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 检查新增的节点
        if (mutation.addedNodes) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (checkForUnsupported(node)) {
                console.log('[CustomCollection] MutationObserver detected unsupported view, will render iframe')
                setShouldRenderIframe(true)
                return
              }
              
              // 检查子节点
              const unsupportedChild = node.querySelector && node.querySelector('[class*="unsupported"], [class*="error"]')
              if (unsupportedChild || checkForUnsupported(node)) {
                console.log('[CustomCollection] MutationObserver detected unsupported view in child, will render iframe')
                setShouldRenderIframe(true)
                return
              }
            }
          }
        }
        
        // 检查文本变化
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          if (checkForUnsupported(mutation.target)) {
            console.log('[CustomCollection] MutationObserver detected unsupported view in text, will render iframe')
            setShouldRenderIframe(true)
            return
          }
        }
      }
    })
    
    // 开始观察
    observerRef.current.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    })
    
    // 立即检查一次（可能已经渲染了）
    if (checkForUnsupported(container)) {
      console.log('[CustomCollection] Initial check detected unsupported view, will render iframe')
      setShouldRenderIframe(true)
    }
    
    // Fallback: 2秒后如果还没检测到，也尝试渲染 iframe
    fallbackTimerRef.current = setTimeout(() => {
      if (!shouldRenderIframe) {
        console.log('[CustomCollection] Fallback: 2 seconds passed, will render iframe anyway')
        setShouldRenderIframe(true)
      }
    }, 2000)
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 如果没有 collectionView 但有 pageId，先渲染原始组件并监听 DOM 变化
  if (!collectionView && collectionPageId && isBrowser) {
    console.log('[CustomCollection] No collectionView but has pageId, setting up detection:', {
      pageId: collectionPageId,
      shouldRenderIframe,
      hasContainer: !!containerRef.current
    })
    
    return (
      <div ref={containerRef}>
        {shouldRenderIframe ? (
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
                console.log('[CustomCollection] Map view iframe loaded successfully for pageId:', collectionPageId)
              }}
              onError={(e) => {
                console.error('[CustomCollection] Map view iframe failed to load:', e, 'pageId:', collectionPageId)
              }}
            />
          </div>
        ) : (
          <OriginalCollection {...props} />
        )}
      </div>
    )
  }

  // 其他视图类型使用原始组件
  return <OriginalCollection {...props} />
}

export default CustomCollection

