import dynamic from 'next/dynamic'
import { useMemo } from 'react'
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
  const { collectionView, recordMap } = props

  // 检测视图类型
  const viewType = useMemo(() => {
    if (!collectionView || !recordMap) return null
    
    const viewId = Object.keys(collectionView)[0]
    const view = collectionView[viewId]?.value
    
    return view?.type || null
  }, [collectionView, recordMap])

  // 获取 collection 的 pageId（用于构建 Notion 公开链接）
  const collectionPageId = useMemo(() => {
    if (!recordMap?.block) return null
    
    // 方法1: 从 props 中获取 block ID（如果存在）
    if (props?.blockId) {
      return props.blockId.replace(/-/g, '')
    }
    
    // 方法2: 查找 collection_view 或 collection_view_page 类型的 block
    const blocks = recordMap.block
    for (const blockId in blocks) {
      const block = blocks[blockId]?.value
      if (block?.type === 'collection_view' || block?.type === 'collection_view_page') {
        // 移除连字符，格式化为 Notion 页面 ID
        return blockId.replace(/-/g, '')
      }
    }
    
    // 方法3: 如果 collection_view_page，尝试从 collectionView 中获取
    if (collectionView) {
      const viewId = Object.keys(collectionView)[0]
      if (viewId) {
        // 尝试从 view 中获取关联的页面 ID
        const view = collectionView[viewId]?.value
        if (view?.format?.collection_pointer?.id) {
          return view.format.collection_pointer.id.replace(/-/g, '')
        }
      }
    }
    
    return null
  }, [recordMap, props, collectionView])

  // 如果是 map view，使用 iframe 嵌入 Notion 页面
  if (viewType === 'map' && collectionPageId && isBrowser) {
    // 构建 Notion 公开页面 URL
    // 注意：需要将 Notion 页面设置为公开访问
    const notionPageUrl = `https://www.notion.so/${collectionPageId}`
    
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
        />
      </div>
    )
  }

  // 其他视图类型使用原始组件
  return <OriginalCollection {...props} />
}

export default CustomCollection

