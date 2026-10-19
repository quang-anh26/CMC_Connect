import React from 'react'
import { Link } from 'react-router-dom'
import { MessengerLogo } from './Icons'
import {
  CheckIcon,
  MailIcon,
  MessageIcon,
  ShieldCheckIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  VideoIcon,
  ZapIcon,
} from './AuthIcons'

const REGISTER_STEPS = [
  { icon: MailIcon, title: 'Nhập email', desc: 'Nhận mã xác thực gồm 6 chữ số.' },
  { icon: ShieldCheckIcon, title: 'Xác thực mã', desc: 'Nhập mã vừa được gửi về email.' },
  { icon: UserPlusIcon, title: 'Tạo tài khoản', desc: 'Đặt tên, username và mật khẩu.' },
]

const FEATURES = [
  { icon: ZapIcon, title: 'Thời gian thực', desc: 'Tin nhắn đến ngay lập tức, 1-1 hoặc nhóm.' },
  { icon: VideoIcon, title: 'Gọi thoại & video', desc: 'Kết nối với bạn bè chỉ một cú chạm.' },
  { icon: UsersIcon, title: 'Cộng đồng', desc: 'Bảng tin, nhóm và sự kiện trong một nơi.' },
  { icon: ShieldCheckIcon, title: 'An toàn', desc: 'Xác thực email, mật khẩu được mã hóa.' },
]

/** Minh họa trang trí: bong bóng chat phát sáng trên bệ, xung quanh là các thẻ nổi. */
function Illustration() {
  return (
    <div className="ap-illustration" aria-hidden="true">
      <div className="ap-platform">
        <span />
        <span />
        <span />
      </div>
      <div className="ap-core"><MessengerLogo size={168} /></div>
      <div className="ap-float f1"><UserIcon size={30} /></div>
      <div className="ap-float f2"><MessageIcon size={30} /></div>
      <div className="ap-float f3"><VideoIcon size={30} /></div>
      <div className="ap-float f4"><ShieldCheckIcon size={30} /></div>
      <i className="ap-dot d1" />
      <i className="ap-dot d2" />
      <i className="ap-dot d3" />
    </div>
  )
}

/**
 * Khung dùng chung cho trang Đăng nhập / Đăng ký (nền xanh đậm, thẻ kính mờ, hai cột).
 *
 *  - hero:       { lead, accent, text } - tiêu đề lớn bên trái (accent được tô màu)
 *  - title/subtitle/badge: phần đầu thẻ biểu mẫu bên phải
 *  - activeStep: 1..3 cho trang đăng ký (hiện thanh tiến trình + 3 bước), null cho đăng nhập (hiện 4 tính năng)
 */
export default function AuthLayout({ badge, title, subtitle, hero, activeStep = null, children }) {
  const isRegister = activeStep != null

  return (
    <div className="ap-page">
      <header className="ap-topbar">
        <Link to="/login" className="ap-brand" aria-label="CMC Talk">
          <MessengerLogo size={48} />
          <span className="ap-brand-text">
            <strong>CMC Talk</strong>
            <small>Kết nối - Trò chuyện - Chia sẻ</small>
          </span>
        </Link>
      </header>

      <main className="ap-main">
        <section className="ap-hero">
          <h1>{hero.lead} <em>{hero.accent}</em></h1>
          <p>{hero.text}</p>

          <Illustration />

          {isRegister ? (
            <ol className="ap-bottom">
              {REGISTER_STEPS.map((step, index) => {
                const number = index + 1
                const state = number < activeStep ? 'is-done' : number === activeStep ? 'is-active' : ''
                const Icon = step.icon
                return (
                  <li key={step.title} className={`ap-feature ${state}`}>
                    <span className="ap-feature-icon">
                      {state === 'is-done' ? <CheckIcon size={22} strokeWidth={3} /> : <Icon size={22} />}
                      <b>{number}</b>
                    </span>
                    <strong>{step.title}</strong>
                    <small>{step.desc}</small>
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="ap-bottom">
              {FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <div key={feature.title} className="ap-feature">
                    <span className="ap-feature-icon"><Icon size={22} /></span>
                    <strong>{feature.title}</strong>
                    <small>{feature.desc}</small>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="ap-card" aria-labelledby="ap-form-title">
          {isRegister && (
            <div
              className="ap-progress"
              role="progressbar"
              aria-label="Tiến trình đăng ký"
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={activeStep}
            >
              {[1, 2, 3].map((n) => <span key={n} className={n <= activeStep ? 'on' : ''} />)}
            </div>
          )}

          <div className="ap-card-head">
            <span className="ap-badge">{badge}</span>
            <div>
              <h2 id="ap-form-title">{title}</h2>
              <p>{subtitle}</p>
            </div>
          </div>

          {children}
        </section>
      </main>
    </div>
  )
}
