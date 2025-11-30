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
  const [viewId, setViewId] = useState(null)
  const [cspError, setCspError] = useState(false)
  const [urlAttempt, setUrlAttempt] = useState(1)
  const [iframeError, setIframeError] = useState(false)
  const containerRef = useRef(null)
  const observerRef = useRef(null)
  const fallbackTimerRef = useRef(null)
  
  // 提取 viewId - 从多个来源尝试获取
  const extractedViewId = useMemo(() => {
    // 方法1: 从 collectionView 中获取
    if (collectionView) {
      const viewKeys = Object.keys(collectionView)
      if (viewKeys.length > 0) {
        const vid = viewKeys[0].replace(/-/g, '')
        if (isBrowser) {
          console.log('[CustomCollection] Got viewId from collectionView:', vid)
        }
        return vid
      }
    }
    
    // 方法2: 从 props 中查找
    if (props?.viewIds && props.viewIds.length > 0) {
      const vid = props.viewIds[0].replace(/-/g, '')
      if (isBrowser) {
        console.log('[CustomCollection] Got viewId from props.viewIds:', vid)
      }
      return vid
    }
    
    // 方法3: 从 recordMap 中查找 collection_view
    if (recordMap?.collection_view) {
      const viewKeys = Object.keys(recordMap.collection_view)
      if (viewKeys.length > 0) {
        const vid = viewKeys[0].replace(/-/g, '')
        if (isBrowser) {
          console.log('[CustomCollection] Got viewId from recordMap.collection_view:', vid)
        }
        return vid
      }
    }
    
    // 方法4: 从 block 中查找 view_ids
    if (block?.value?.view_ids && block.value.view_ids.length > 0) {
      const vid = block.value.view_ids[0].replace(/-/g, '')
      if (isBrowser) {
        console.log('[CustomCollection] Got viewId from block.value.view_ids:', vid)
      }
      return vid
    }
    
    return null
  }, [collectionView, props, recordMap, block])
  
  // 拦截 console 来提取 viewId 和检测 CSP 错误
  useEffect(() => {
    if (!isBrowser || collectionView) return
    
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    
    const interceptLog = (method, ...args) => {
      // 检查是否是 unsupported collection view 日志
      let foundUnsupported = false
      let viewObject = null
      
      // 检查所有参数
      for (const arg of args) {
        // 检查字符串参数
        if (typeof arg === 'string') {
          if (arg.includes('unsupported collection view') || arg.includes('Unsupported collection view')) {
            foundUnsupported = true
          }
          // 检测 CSP 错误
          if (arg.includes('Content Security Policy') || arg.includes('frame-ancestors') || arg.includes('violates')) {
            console.log('[CustomCollection] ⚠️ CSP error detected in console')
            setTimeout(() => setCspError(true), 100)
          }
        }
        // 检查对象参数（包含 id 和 type: 'map'）
        if (arg && typeof arg === 'object' && !Array.isArray(arg) && arg.id && arg.type === 'map') {
          viewObject = arg
        }
      }
      
      // 如果找到 unsupported 消息和 view 对象，提取 viewId
      if (foundUnsupported && viewObject && !viewId) {
        const vid = viewObject.id.replace(/-/g, '')
        console.log('[CustomCollection] ✅ Extracted viewId from console log:', vid, {
          originalId: viewObject.id,
          type: viewObject.type,
          name: viewObject.name
        })
        setViewId(vid)
      }
      
      method.apply(console, args)
    }
    
    console.log = (...args) => interceptLog(originalLog, ...args)
    console.warn = (...args) => interceptLog(originalWarn, ...args)
    console.error = (...args) => interceptLog(originalError, ...args)
    
    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    }
  }, [isBrowser, collectionView, viewId])
  
  // 使用提取的 viewId 或从其他来源获取的 viewId
  const finalViewId = viewId || extractedViewId
  
  // 使用 MutationObserver 监听 DOM 变化，检测 unsupported view
  useEffect(() => {
    if (!isBrowser || !collectionPageId || collectionView) return
    if (shouldRenderIframe) return // 如果已经决定渲染 iframe，不再监听
    
    const container = containerRef.current
    if (!container) return
    
    console.log('[CustomCollection] Setting up MutationObserver for unsupported view detection', {
      hasViewId: !!finalViewId,
      viewId: finalViewId
    })
    
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

  // 构建 Notion URL 的辅助函数
  const buildNotionUrl = (pageId, vid = null, attempt = 1) => {
    // 尝试从 props 或 recordMap 中获取 workspace
    // 如果无法获取，使用基础格式
    const baseUrl = `https://www.notion.so/${pageId}`
    
    // 尝试不同的 URL 格式
    if (attempt === 1 && vid) {
      // 格式1: 包含 viewId（推荐格式）
      return `${baseUrl}?v=${vid}`
    } else if (attempt === 2 && vid) {
      // 格式2: 包含 viewId 和 embed 参数
      return `${baseUrl}?v=${vid}&embed=true`
    } else if (attempt === 3 && vid) {
      // 格式3: 包含 viewId 和 source 参数（类似用户提供的链接）
      return `${baseUrl}?v=${vid}&source=copy_link`
    } else if (attempt === 4) {
      // 格式4: 只有 embed 参数
      return `${baseUrl}?embed=true`
    } else {
      // 格式5: 基础 URL
      return baseUrl
    }
  }

  // 如果是 map view，使用 iframe 嵌入 Notion 页面
  if (isMapView && collectionPageId && isBrowser) {
    const mapViewUrl = buildNotionUrl(collectionPageId, finalViewId, urlAttempt)
    
    console.log('[CustomCollection] Rendering map view iframe:', {
      viewType,
      collectionPageId,
      viewId: finalViewId,
      urlAttempt,
      mapViewUrl,
      props: Object.keys(props)
    })
    
    if (cspError || iframeError) {
      return (
        <div className="notion-map-view-fallback" style={{
          width: '100%',
          padding: '2rem',
          margin: '1rem 0',
          border: '1px solid var(--fg-color-1)',
          borderRadius: '4px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-color)'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>🗺️ 地图视图</h3>
          <p style={{ marginBottom: '1.5rem', color: 'var(--fg-color-2)' }}>
            由于安全限制，地图无法直接嵌入。请点击下方链接在新窗口中查看。
          </p>
          <a
            href={mapViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--fg-color)',
              color: 'var(--bg-color)',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            在 Notion 中查看地图 →
          </a>
        </div>
      )
    }
    
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
          key={urlAttempt}
          src={mapViewUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          allowFullScreen
          title="Notion Map View"
          onLoad={() => {
            console.log('[CustomCollection] Map view iframe loaded:', mapViewUrl)
          }}
          onError={(e) => {
            console.error('[CustomCollection] Map view iframe error:', e, 'URL:', mapViewUrl)
            if (urlAttempt < 5) {
              setTimeout(() => setUrlAttempt(urlAttempt + 1), 100)
            } else {
              setIframeError(true)
            }
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
    const currentUrl = buildNotionUrl(collectionPageId, finalViewId, urlAttempt)
    
    console.log('[CustomCollection] Rendering iframe for unsupported view:', {
      pageId: collectionPageId,
      viewId: finalViewId,
      urlAttempt,
      currentUrl,
      cspError
    })
    
    // 如果 CSP 错误，显示替代 UI
    if (cspError || iframeError) {
      return (
        <div className="notion-map-view-fallback" style={{
          width: '100%',
          padding: '2rem',
          margin: '1rem 0',
          border: '1px solid var(--fg-color-1)',
          borderRadius: '4px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-color)'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>🗺️ 地图视图</h3>
          <p style={{ marginBottom: '1.5rem', color: 'var(--fg-color-2)' }}>
            由于安全限制，地图无法直接嵌入。请点击下方链接在新窗口中查看。
          </p>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--fg-color)',
              color: 'var(--bg-color)',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            在 Notion 中查看地图 →
          </a>
        </div>
      )
    }
    
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
          key={urlAttempt}
          src={currentUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          allowFullScreen
          title="Notion Map View"
          onLoad={() => {
            console.log('[CustomCollection] Iframe onLoad event triggered:', currentUrl)
            // 延迟检查 iframe 内容是否真的加载了（CSP 可能不会触发 onError）
            setTimeout(() => {
              try {
                const iframes = document.querySelectorAll('iframe[title="Notion Map View"]')
                const currentIframe = Array.from(iframes).find(iframe => iframe.src === currentUrl)
                if (currentIframe) {
                  try {
                    // 尝试访问 iframe 内容
                    const doc = currentIframe.contentWindow?.document
                    if (!doc || (doc.location && doc.location.href === 'about:blank')) {
                      console.warn('[CustomCollection] Iframe content is blank, possible CSP block')
                      setCspError(true)
                      return
                    }
                    console.log('[CustomCollection] ✅ Iframe content loaded successfully')
                  } catch (e) {
                    // 跨域错误是正常的，但如果是 CSP 错误会有特定消息
                    if (e.message && (e.message.includes('Blocked') || e.message.includes('frame'))) {
                      console.warn('[CustomCollection] ⚠️ Possible CSP error:', e.message)
                      setCspError(true)
                    } else {
                      console.log('[CustomCollection] Cross-origin access (expected):', e.message)
                    }
                  }
                }
              } catch (err) {
                console.warn('[CustomCollection] Error checking iframe:', err)
              }
            }, 2000)
          }}
          onError={(e) => {
            console.error('[CustomCollection] Iframe onError:', e, 'URL:', currentUrl)
            if (urlAttempt < 5) {
              console.log('[CustomCollection] Trying next URL format, attempt:', urlAttempt + 1)
              setTimeout(() => setUrlAttempt(urlAttempt + 1), 100)
            } else {
              console.log('[CustomCollection] All URL attempts failed')
              setIframeError(true)
            }
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
            {(cspError || iframeError) ? (
              <div className="notion-map-view-fallback" style={{
                width: '100%',
                padding: '2rem',
                margin: '1rem 0',
                border: '1px solid var(--fg-color-1)',
                borderRadius: '4px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-color)'
              }}>
                <h3 style={{ marginBottom: '1rem' }}>🗺️ 地图视图</h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--fg-color-2)' }}>
                  由于安全限制，地图无法直接嵌入。请点击下方链接在新窗口中查看。
                </p>
                <a
                  href={buildNotionUrl(collectionPageId, finalViewId, 1)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--fg-color)',
                    color: 'var(--bg-color)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  在 Notion 中查看地图 →
                </a>
              </div>
            ) : (
              <iframe
                key={urlAttempt}
                src={buildNotionUrl(collectionPageId, finalViewId, urlAttempt)}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                allowFullScreen
                title="Notion Map View"
                onLoad={() => {
                  const currentUrl = buildNotionUrl(collectionPageId, finalViewId, urlAttempt)
                  console.log('[CustomCollection] Iframe onLoad event triggered for pageId:', collectionPageId, 'URL:', currentUrl)
                  // 延迟检查 iframe 内容是否真的加载了（CSP 可能不会触发 onError）
                  setTimeout(() => {
                    try {
                      const iframes = document.querySelectorAll('iframe[title="Notion Map View"]')
                      const currentIframe = Array.from(iframes).find(iframe => iframe.src === currentUrl)
                      if (currentIframe) {
                        try {
                          // 尝试访问 iframe 内容
                          const doc = currentIframe.contentWindow?.document
                          if (!doc || (doc.location && doc.location.href === 'about:blank')) {
                            console.warn('[CustomCollection] Iframe content is blank, possible CSP block')
                            setCspError(true)
                            return
                          }
                          console.log('[CustomCollection] ✅ Iframe content loaded successfully')
                        } catch (e) {
                          // 跨域错误是正常的，但如果是 CSP 错误会有特定消息
                          if (e.message && (e.message.includes('Blocked') || e.message.includes('frame'))) {
                            console.warn('[CustomCollection] ⚠️ Possible CSP error:', e.message)
                            setCspError(true)
                          } else {
                            console.log('[CustomCollection] Cross-origin access (expected):', e.message)
                          }
                        }
                      }
                    } catch (err) {
                      console.warn('[CustomCollection] Error checking iframe:', err)
                    }
                  }, 2000)
                }}
                onError={(e) => {
                  console.error('[CustomCollection] Iframe onError:', e, 'pageId:', collectionPageId)
                  if (urlAttempt < 5) {
                    console.log('[CustomCollection] Trying next URL format, attempt:', urlAttempt + 1)
                    setTimeout(() => setUrlAttempt(urlAttempt + 1), 100)
                  } else {
                    console.log('[CustomCollection] All URL attempts failed')
                    setIframeError(true)
                  }
                }}
              />
            )}
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

