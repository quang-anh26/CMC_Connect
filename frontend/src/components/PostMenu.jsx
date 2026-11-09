import React, { useEffect, useRef, useState } from 'react'
import { feedApi } from '../api/feedApi'

const privacyOptions = [
  { value: 'PUBLIC', label: 'Công khai', icon: '🌐' },
  { value: 'FRIENDS', label: 'Bạn bè', icon: '👥' },
  { value: 'PRIVATE', label: 'Chỉ mình tôi', icon: '🔒' },
]

export default function PostMenu({ post, currentUserId, onPostUpdated, onPostDeleted, onError }) {
  const [open, setOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const rootRef = useRef(null)
  const isOwner = String(post.authorId) === String(currentUserId)
  const privacy = post.privacy || 'PUBLIC'
  const currentOption = privacyOptions.find((option) => option.value === privacy) || privacyOptions[0]

  useEffect(() => {
    if (!open) return undefined
    const handlePointer = (event) => { if (!rootRef.current?.contains(event.target)) { setOpen(false); setPrivacyOpen(false) } }
    const handleKey = (event) => { if (event.key === 'Escape') { setOpen(false); setPrivacyOpen(false) } }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handlePointer); document.removeEventListener('keydown', handleKey) }
  }, [open])

  const changePrivacy = async (value) => {
    if (!isOwner || savingPrivacy || value === privacy) { setPrivacyOpen(false); return }
    setSavingPrivacy(true)
    try {
      const { data } = await feedApi.updatePrivacy(post.postId, value)
      onPostUpdated?.(data)
      setPrivacyOpen(false)
      setOpen(false)
    } catch (error) {
      onError?.(error.response?.data?.message || 'Không thể cập nhật quyền riêng tư bài viết.')
    } finally { setSavingPrivacy(false) }
  }

  const deletePost = async () => {
    if (!isOwner || !window.confirm('Bạn có chắc chắn muốn xóa bài viết này? Thao tác này không thể hoàn tác.')) return
    try {
      await feedApi.remove(post.postId)
      onPostDeleted?.(post)
      setOpen(false)
    } catch (error) { onError?.(error.response?.data?.message || 'Không thể xóa bài viết. Vui lòng thử lại.') }
  }

  if (!isOwner) return null

  return <div className="post-menu" ref={rootRef}>
    <button type="button" className="post-menu-trigger" aria-label="Tùy chọn bài viết" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen((value) => !value); setPrivacyOpen(false) }}><span aria-hidden="true">•••</span></button>
    {open && <div className="post-menu-popover" role="menu">
      {isOwner && <>
        <button type="button" role="menuitem" onClick={() => setPrivacyOpen((value) => !value)}><span aria-hidden="true">{currentOption.icon}</span><span className="post-menu-copy"><strong>Quyền riêng tư</strong><small>Hiện tại: {currentOption.label}</small></span><span className="post-menu-chevron">{privacyOpen ? '⌄' : '›'}</span></button>
        {privacyOpen && <div className="post-privacy-submenu" aria-label="Chọn quyền riêng tư">{privacyOptions.map((option) => <button type="button" key={option.value} disabled={savingPrivacy} className={privacy === option.value ? 'active' : ''} onClick={() => changePrivacy(option.value)}><span>{option.icon}</span><span>{option.label}</span>{privacy === option.value && <span className="post-privacy-check">✓</span>}</button>)}</div>}
        <button type="button" role="menuitem" className="post-menu-danger" onClick={deletePost}><span aria-hidden="true">⌫</span><span>Xóa bài viết</span></button>
      </>}
    </div>}
  </div>
}
