/* ============================================================
   Tal Makhana — Shopify Theme JavaScript
   AJAX Cart, Drawer, Variants, Mobile Nav
   ============================================================ */
(function () {
  'use strict';

  /* ── Namespace ─────────────────────────────────────────── */
  window.TalMakhana = window.TalMakhana || {};

  /* ── Utilities ─────────────────────────────────────────── */
  function formatMoney(cents) {
    if (typeof cents === 'string') { cents = cents.replace('.', ''); }
    var value = (cents / 100).toFixed(2);
    return '₹' + parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  }

  function fetchJSON(url, options) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }, options))
      .then(function (r) { return r.json(); });
  }

  /* ── Cart API ──────────────────────────────────────────── */
  var Cart = {
    get: function () {
      return fetchJSON('/cart.js');
    },
    add: function (variantId, quantity, properties) {
      return fetchJSON('/cart/add.js', {
        method: 'POST',
        body: JSON.stringify({ id: variantId, quantity: quantity || 1, properties: properties || {} })
      });
    },
    update: function (updates) {
      return fetchJSON('/cart/update.js', {
        method: 'POST',
        body: JSON.stringify({ updates: updates })
      });
    },
    change: function (key, quantity) {
      return fetchJSON('/cart/change.js', {
        method: 'POST',
        body: JSON.stringify({ id: key, quantity: quantity })
      });
    },
    clear: function () {
      return fetchJSON('/cart/clear.js', { method: 'POST' });
    }
  };

  /* ── Cart UI ───────────────────────────────────────────── */
  var CartUI = {
    drawer: null,
    overlay: null,
    countBadges: [],

    init: function () {
      this.drawer = document.getElementById('cart-drawer');
      this.overlay = document.getElementById('cart-overlay');
      this.countBadges = Array.from(document.querySelectorAll('.site-header__cart-count, .cart-drawer__count'));

      var closeBtn = document.getElementById('cart-drawer-close');
      if (closeBtn) { closeBtn.addEventListener('click', this.close.bind(this)); }
      if (this.overlay) { this.overlay.addEventListener('click', this.close.bind(this)); }

      /* Cart icon open */
      document.querySelectorAll('.js-open-cart').forEach(function (btn) {
        btn.addEventListener('click', CartUI.open.bind(CartUI));
      });

      /* Initial render */
      this.refresh();
    },

    open: function () {
      if (!this.drawer) return;
      this.refresh();
      this.drawer.classList.add('open');
      if (this.overlay) { this.overlay.classList.add('open'); }
      document.body.style.overflow = 'hidden';
      this.drawer.setAttribute('aria-hidden', 'false');
    },

    close: function () {
      if (!this.drawer) return;
      this.drawer.classList.remove('open');
      if (this.overlay) { this.overlay.classList.remove('open'); }
      document.body.style.overflow = '';
      this.drawer.setAttribute('aria-hidden', 'true');
    },

    updateCount: function (count) {
      this.countBadges.forEach(function (badge) {
        badge.textContent = count;
        if (count > 0) {
          badge.classList.add('visible');
          badge.style.display = 'flex';
        } else {
          badge.classList.remove('visible');
          badge.style.display = 'none';
        }
      });
    },

    refresh: function () {
      var self = this;
      Cart.get().then(function (cart) {
        self.updateCount(cart.item_count);
        self.renderDrawer(cart);
      });
    },

    renderDrawer: function (cart) {
      var itemsEl = document.getElementById('cart-drawer-items');
      var footerEl = document.getElementById('cart-drawer-footer');
      if (!itemsEl) return;

      if (!cart.item_count) {
        itemsEl.innerHTML =
          '<div class="cart-drawer__empty">' +
            '<div class="cart-drawer__empty-icon">🛒</div>' +
            '<p class="cart-drawer__empty-title">Your cart is empty</p>' +
            '<p class="cart-drawer__empty-desc">Add your favourite Tal Makhana flavours to get started.</p>' +
            '<a href="/collections/all" class="btn btn--primary">Shop Now →</a>' +
          '</div>';
        if (footerEl) footerEl.style.display = 'none';
        return;
      }

      var html = '';
      cart.items.forEach(function (item) {
        var imgHtml = item.image
          ? '<img src="' + item.image + '" alt="' + item.title + '" loading="lazy">'
          : '<span class="cart-drawer__item-placeholder">🌰</span>';

        html +=
          '<div class="cart-drawer__item" data-item-key="' + item.key + '">' +
            '<div class="cart-drawer__item-img">' + imgHtml + '</div>' +
            '<div class="cart-drawer__item-body">' +
              '<div class="cart-drawer__item-title">' + item.product_title + '</div>' +
              (item.variant_title && item.variant_title !== 'Default Title'
                ? '<div class="cart-drawer__item-variant">' + item.variant_title + '</div>' : '') +
              '<div class="cart-drawer__item-price-row">' +
                '<div class="cart-drawer__item-qty-ctrl">' +
                  '<button class="qty-btn" data-action="decrease" data-key="' + item.key + '">−</button>' +
                  '<span class="qty-num">' + item.quantity + '</span>' +
                  '<button class="qty-btn" data-action="increase" data-key="' + item.key + '">+</button>' +
                '</div>' +
                '<div class="cart-drawer__item-price">' + formatMoney(item.final_line_price) + '</div>' +
              '</div>' +
              '<button class="cart-drawer__item-remove" data-key="' + item.key + '">✕ Remove</button>' +
            '</div>' +
          '</div>';
      });

      itemsEl.innerHTML = html;

      /* Bind qty/remove events */
      itemsEl.querySelectorAll('.qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.key;
          var item = cart.items.find(function (i) { return i.key === key; });
          if (!item) return;
          var newQty = btn.dataset.action === 'increase'
            ? Math.min(10, item.quantity + 1)
            : Math.max(0, item.quantity - 1);
          Cart.change(key, newQty).then(function (updatedCart) {
            CartUI.updateCount(updatedCart.item_count);
            CartUI.renderDrawer(updatedCart);
          });
        });
      });

      itemsEl.querySelectorAll('.cart-drawer__item-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Cart.change(btn.dataset.key, 0).then(function (updatedCart) {
            CartUI.updateCount(updatedCart.item_count);
            CartUI.renderDrawer(updatedCart);
            if (footerEl) {
              footerEl.style.display = updatedCart.item_count ? 'block' : 'none';
            }
          });
        });
      });

      if (footerEl) {
        footerEl.style.display = 'block';
        var subtotalEl = document.getElementById('drawer-subtotal');
        if (subtotalEl) { subtotalEl.textContent = formatMoney(cart.total_price); }
      }
    }
  };

  /* ── Add to Cart Form ──────────────────────────────────── */
  function initAddToCartForms() {
    document.querySelectorAll('form[action="/cart/add"]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var variantInput = form.querySelector('[name="id"]');
        var qtyInput = form.querySelector('[name="quantity"]');
        if (!variantInput) return;

        var variantId = variantInput.value;
        var quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
        var submitBtn = form.querySelector('[type="submit"]');

        if (submitBtn) {
          submitBtn.disabled = true;
          var originalText = submitBtn.innerHTML;
          submitBtn.innerHTML = 'Adding…';
        }

        Cart.add(variantId, quantity).then(function () {
          if (submitBtn) {
            submitBtn.innerHTML = '✅ Added!';
            submitBtn.style.background = 'var(--green)';
            setTimeout(function () {
              submitBtn.innerHTML = originalText;
              submitBtn.style.background = '';
              submitBtn.disabled = false;
            }, 2000);
          }
          CartUI.open();
        }).catch(function (err) {
          if (submitBtn) {
            submitBtn.innerHTML = 'Out of Stock';
            submitBtn.disabled = false;
          }
          console.error('Cart add error:', err);
        });
      });
    });
  }

  /* ── Variant Selector ──────────────────────────────────── */
  function initVariantSelectors() {
    document.querySelectorAll('.js-variant-select').forEach(function (select) {
      select.addEventListener('change', function () {
        var variantId = select.value;
        var form = select.closest('form');
        if (!form) return;

        var hiddenInput = form.querySelector('[name="id"]');
        if (hiddenInput) hiddenInput.value = variantId;

        /* Find variant data */
        var variantData = window.productVariants;
        if (variantData) {
          var variant = variantData.find(function (v) { return String(v.id) === String(variantId); });
          if (variant) {
            var priceEl = document.querySelector('.js-product-price');
            var comparePriceEl = document.querySelector('.js-compare-price');
            var availabilityEl = document.querySelector('.js-availability');
            var submitBtn = form.querySelector('[type="submit"]');

            if (priceEl) { priceEl.textContent = formatMoney(variant.price); }
            if (comparePriceEl) {
              if (variant.compare_at_price && variant.compare_at_price > variant.price) {
                comparePriceEl.textContent = formatMoney(variant.compare_at_price);
                comparePriceEl.style.display = '';
              } else {
                comparePriceEl.style.display = 'none';
              }
            }
            if (availabilityEl) {
              availabilityEl.textContent = variant.available ? 'In Stock' : 'Out of Stock';
              availabilityEl.className = 'js-availability ' + (variant.available ? 'text-green' : 'text-terra');
            }
            if (submitBtn) {
              submitBtn.disabled = !variant.available;
              if (!variant.available) { submitBtn.textContent = 'Out of Stock'; }
            }
          }
        }
      });
    });

    /* Swatch / button variant selectors */
    document.querySelectorAll('.js-variant-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.closest('.js-variant-group');
        if (group) {
          group.querySelectorAll('.js-variant-btn').forEach(function (b) { b.classList.remove('active'); });
        }
        btn.classList.add('active');

        /* Build selected options and find matching variant */
        var form = btn.closest('form');
        if (!form) return;
        var selectedOptions = {};
        form.querySelectorAll('.js-variant-btn.active').forEach(function (activeBtn) {
          var pos = activeBtn.dataset.optionPosition;
          var val = activeBtn.dataset.optionValue;
          if (pos) selectedOptions[pos] = val;
        });

        var variantData = window.productVariants;
        if (variantData) {
          var matched = variantData.find(function (v) {
            return Object.keys(selectedOptions).every(function (pos) {
              return v['option' + pos] === selectedOptions[pos];
            });
          });
          if (matched) {
            var hiddenInput = form.querySelector('[name="id"]');
            if (hiddenInput) hiddenInput.value = matched.id;
            /* Trigger change event for price updates */
            var select = form.querySelector('.js-variant-select');
            if (select) {
              select.value = matched.id;
              select.dispatchEvent(new Event('change'));
            }
          }
        }
      });
    });
  }

  /* ── Qty Controls (product page) ───────────────────────── */
  function initQtyControls() {
    document.querySelectorAll('.js-qty-control').forEach(function (ctrl) {
      var numEl = ctrl.querySelector('.js-qty-num');
      var input = ctrl.querySelector('input[name="quantity"]');

      ctrl.querySelector('.js-qty-decrease').addEventListener('click', function () {
        var val = Math.max(1, (parseInt(numEl.textContent) || 1) - 1);
        numEl.textContent = val;
        if (input) input.value = val;
        updateCartBtnPrice();
      });

      ctrl.querySelector('.js-qty-increase').forEach && ctrl.querySelector('.js-qty-increase').addEventListener('click', function () {
        var val = Math.min(10, (parseInt(numEl.textContent) || 1) + 1);
        numEl.textContent = val;
        if (input) input.value = val;
        updateCartBtnPrice();
      });
    });

    document.querySelectorAll('.js-qty-increase').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ctrl = btn.closest('.js-qty-control');
        if (!ctrl) return;
        var numEl = ctrl.querySelector('.js-qty-num');
        var input = ctrl.querySelector('input[name="quantity"]');
        var val = Math.min(10, (parseInt(numEl.textContent) || 1) + 1);
        numEl.textContent = val;
        if (input) input.value = val;
        updateCartBtnPrice();
      });
    });

    document.querySelectorAll('.js-qty-decrease').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ctrl = btn.closest('.js-qty-control');
        if (!ctrl) return;
        var numEl = ctrl.querySelector('.js-qty-num');
        var input = ctrl.querySelector('input[name="quantity"]');
        var val = Math.max(1, (parseInt(numEl.textContent) || 1) - 1);
        numEl.textContent = val;
        if (input) input.value = val;
        updateCartBtnPrice();
      });
    });
  }

  function updateCartBtnPrice() {
    var priceEl = document.querySelector('.js-product-price');
    var qtyEl = document.querySelector('.js-qty-num');
    var btnPriceEl = document.querySelector('.js-cart-btn-price');
    if (priceEl && qtyEl && btnPriceEl) {
      var priceText = priceEl.textContent.replace(/[^\d]/g, '');
      var qty = parseInt(qtyEl.textContent) || 1;
      var total = (parseInt(priceText) * qty);
      btnPriceEl.textContent = '₹' + total.toLocaleString('en-IN');
    }
  }

  /* ── Mobile Menu ───────────────────────────────────────── */
  function initMobileMenu() {
    var toggle = document.querySelector('.site-header__mobile-toggle');
    var nav = document.querySelector('.site-header__mobile-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.textContent = isOpen ? '×' : '☰';
    });
  }

  /* ── Gallery Thumbnail Switcher ────────────────────────── */
  function initGallery() {
    document.querySelectorAll('.js-gallery-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var gallery = thumb.closest('.gallery');
        if (!gallery) return;

        gallery.querySelectorAll('.js-gallery-thumb').forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');

        var mainImg = gallery.querySelector('.js-gallery-main img');
        var mainEmoji = gallery.querySelector('.js-gallery-main-emoji');
        var src = thumb.dataset.src;
        var emoji = thumb.dataset.emoji;

        if (mainImg && src) { mainImg.src = src; }
        if (mainEmoji && emoji) { mainEmoji.textContent = emoji; }
      });
    });
  }

  /* ── Product Tabs ──────────────────────────────────────── */
  function initProductTabs() {
    document.querySelectorAll('.js-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.dataset.tab;
        var container = btn.closest('.js-tabs-container');
        if (!container) return;

        container.querySelectorAll('.js-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        container.querySelectorAll('.js-tab-panel').forEach(function (p) { p.classList.remove('active'); });

        btn.classList.add('active');
        var panel = container.querySelector('[data-tab-panel="' + targetId + '"]');
        if (panel) { panel.classList.add('active'); }
      });
    });
  }

  /* ── Blog Category Filter ──────────────────────────────── */
  function initCategoryFilter() {
    document.querySelectorAll('.js-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.dataset.filter;
        var grid = document.querySelector('.js-filter-grid');
        if (!grid) return;

        document.querySelectorAll('.js-filter-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        grid.querySelectorAll('[data-cat]').forEach(function (card) {
          card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
        });
      });
    });
  }

  /* ── Announcement Bar Close ────────────────────────────── */
  function initAnnouncementBar() {
    var closeBtn = document.querySelector('.announcement-bar__close');
    var bar = document.querySelector('.announcement-bar');
    if (!closeBtn || !bar) return;
    closeBtn.addEventListener('click', function () {
      bar.style.display = 'none';
    });
  }

  /* ── Scroll animations ─────────────────────────────────── */
  function initScrollObserver() {
    if (!window.IntersectionObserver) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card, .blog-card, .benefit-card, .video-card').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── Cart page inline handlers ─────────────────────────── */
  function initCartPage() {
    var cartPage = document.querySelector('.cart-page');
    if (!cartPage) return;

    cartPage.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cart-action]');
      if (!btn) return;
      var action = btn.dataset.cartAction;
      var key = btn.dataset.key;
      var qty = parseInt(btn.dataset.qty) || 0;

      if (action === 'remove') {
        Cart.change(key, 0).then(function () { location.reload(); });
      } else if (action === 'increase') {
        Cart.change(key, qty + 1).then(function () { location.reload(); });
      } else if (action === 'decrease') {
        if (qty > 1) {
          Cart.change(key, qty - 1).then(function () { location.reload(); });
        } else {
          Cart.change(key, 0).then(function () { location.reload(); });
        }
      }
    });
  }

  /* ── Expose public API ─────────────────────────────────── */
  TalMakhana.cart = {
    open: function () { CartUI.open(); },
    close: function () { CartUI.close(); },
    refresh: function () { CartUI.refresh(); },
    add: function (variantId, qty) {
      return Cart.add(variantId, qty).then(function (result) {
        CartUI.refresh();
        CartUI.open();
        return result;
      });
    }
  };

  /* ── Init ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    CartUI.init();
    initAddToCartForms();
    initVariantSelectors();
    initQtyControls();
    initMobileMenu();
    initGallery();
    initProductTabs();
    initCategoryFilter();
    initAnnouncementBar();
    initCartPage();
    initScrollObserver();

    /* Escape key closes drawer */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { CartUI.close(); }
    });
  });

})();
