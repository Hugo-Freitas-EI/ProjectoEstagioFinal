# NodeCMS

CMS completo em Node.js + Express + MySQL (compatível com tabelas WordPress).

---

## 📋 Requisitos

- Node.js 18+
- Laragon com MySQL
- Base de dados `cms_database` com as tabelas `wp_posts` e `registers`

---

## 🚀 Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Confirmar o .env (já configurado para Laragon)
# PORT=3000
# DB_HOST=127.0.0.1
# DB_USER=root
# DB_PASSWORD=
# DB_NAME=cms_database

# 3. Arrancar em desenvolvimento (com auto-reload)
npm run dev

# 4. Ou em produção
npm start
```

---

## 🌐 URLs

| URL | Descrição |
|-----|-----------|
| `http://localhost:3000` | Site público |
| `http://localhost:3000/admin` | Painel de admin |
| `http://localhost:3000/admin/login` | Login |
| `http://localhost:3000/admin/register` | Criar conta |
| `http://localhost:3000/post/:slug` | Post individual |
| `http://localhost:3000/page/:slug` | Página estática |

---

## 🔌 API REST (requer autenticação)

### Posts / Páginas
```
GET    /admin/api/posts?type=post&status=publish&search=texto&page=1
GET    /admin/api/posts/:id
POST   /admin/api/posts
PUT    /admin/api/posts/:id
DELETE /admin/api/posts/:id
GET    /admin/api/posts/stats/overview
```

### Utilizadores
```
GET    /admin/api/users
GET    /admin/api/users/:id
POST   /admin/api/users
PUT    /admin/api/users/:id
DELETE /admin/api/users/:id
```

### Media
```
GET    /admin/api/media
POST   /admin/api/media/upload   (multipart/form-data, campo: "file")
DELETE /admin/api/media/:filename
```

---

## 📁 Estrutura

```
nodecms/
├── server.js              ← Entrada principal
├── db.js                  ← Ligação MySQL (pool)
├── .env                   ← Configuração
├── middleware/
│   └── auth.js            ← JWT middleware
├── routes/
│   ├── auth.js            ← Login / Register / Logout
│   ├── admin.js           ← Painel SPA
│   ├── posts.js           ← API de posts (wp_posts)
│   ├── users.js           ← API de utilizadores (registers)
│   ├── media.js           ← Upload de ficheiros
│   └── frontend.js        ← Site público com Markdown
└── public/
    └── uploads/           ← Ficheiros carregados
```

---

## 🗄️ Tabelas MySQL usadas

| Tabela | Uso |
|--------|-----|
| `wp_posts` | Posts, páginas e todo o conteúdo |
| `registers` | Utilizadores e autenticação |

O CMS usa `post_type` para distinguir:
- `post_type = 'post'` → artigos
- `post_type = 'page'` → páginas estáticas

---

## ❌ Ainda não implementado

- [ ] Sistema de categorias e tags (tabelas `wp_terms`, `wp_term_relationships`)
- [ ] Comentários (tabela `wp_comments`)
- [ ] Meta dados de posts (tabela `wp_postmeta`)
- [ ] Sistema de temas (templates dinâmicos)
- [ ] Agendamento de publicação
- [ ] Revisões de posts
- [ ] Pesquisa full-text no frontend
- [ ] Painel de definições do site (guardadas em BD)
- [ ] OAuth / Login social (campos já existem em `registers`)
- [ ] Editor WYSIWYG (TinyMCE, Quill)
- [ ] Sistema de plugins
- [ ] Sitemap.xml e robots.txt automáticos
- [ ] Cache de páginas
- [ ] API REST pública (sem auth)


npm run dev