(function($) {
    
    var wrapError = function(onError, model, options) {
        return function(resp) {
            if (onError) {
                onError(model, resp, options);
            } else {
                model.trigger('error', model, resp, options);
            }
        };
    };

    sync = function(method, model, options) {
        var actions = {
            'create': 'save_related_content',
            'update': 'save_related_content',
            'read'  : 'fetch_related_content'
        };
        
        var data = options.data || {};
        if (!data.action) {
            data.action = actions[method];
        }
        
        _.extend(data, model.toJSON());
        
        if (!data.action) return;
        
        $.ajax({
            url: window.ajaxurl,
            type: 'POST',
            data: data,
            success: options.success,
            error: options.error
        });
    }
    
    // one link, to a post, topic, or somewhere else
    var Link = Backbone.Model.extend({
        
        initialize: function(attributes, options) {
            this.view = new LinkView({ model: this });
            return this;
        },
        
        defaults: {
            title: "",
            permalink: "",
            type: "post",
            thumbnail: "",
            order: 0,
            date: null
        },
        
        url: window.ajaxurl
    });
    
    // container model for a group of links
    var RelatedContentModule = Backbone.Model.extend({
        
        defaults: {
            title: "",
            links: [],
            topics: []
        },
        
        sync: sync,
        
        url: window.ajaxurl,
        
        initialize: function(attributes, options) {
            this.set({ post_parent: $('#post_ID').val()});
            this.fetch({
                data: {
                    action: 'get_create_related_module',
                    post_parent: this.get('post_parent')
                }
            });
            return this;
        }
    });
    
    // collections are simple
    // we need two here: links/posts and topics
    window.LinkList = Backbone.Collection.extend({
        sync: sync,
        
        model: Link,
        
        url: window.ajaxurl,
        
        initialize: function(models, options) {
            // a helper for later
            this.name = options.name;
            return this;
        },
        
        comparator: function(link) {
            return link.get('order');
        }        
    });
    
    var LINK_TEMPLATE = '<a href="<%= permalink %>">' +
                        '<% if (thumbnail) { %>' +
                        '<img src="<%= thumbnail %>" height="40" width="40">' +
                        '<% } %>' + 
                        '<%= type.toUpperCase() %>: <%= title %></a>' +
                        '<span class="info"><%= date %></span>';
    
    var LinkView = Backbone.View.extend({
        
        className: 'link',
        
        events: {
            'click a' : 'chooseLink'
        },
        
        template: _.template(LINK_TEMPLATE),
        
        initialize: function(options) {
            _.bindAll(this);
            return this.render();
        },
        
        render: function() {
            $(this.el).attr('id', this.model.id);            
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        },
        
        chooseLink: function(e) {
            e.preventDefault();
            var link = this.model;
            if (link.collection.name === "search") {
                // it's in the search box, not chosen yet
                link.collection.remove(link);
                
                if (link.get('type') === "topic") {
                    window.related_content_builder.topics.collection.add(link);
                } else {
                    window.related_content_builder.links.collection.add(link);
                }
            } else {
                // it's already been chosen, so we're un-choosing
                link.collection.remove(link);
                window.related_content_builder.search.collection.add(link);
            }
        }
    });
    
    // view for a collection of links of any type
    var LinkListView = Backbone.View.extend({
        
        initialize: function(options) {
            _.bindAll(this);
            this.collection.bind('reset', this.render);
            this.collection.bind('add', this.addLink);
            
            var that = this;
            if (options.sortable) {
                var el = $(this.el);
                el.sortable({
                    cursor: 'pointer',
                    update: function(event, ui) {
                        el.children('div.link').each(function(i) {
                            var id = $(this).attr('id');
                            var link = that.collection.get(id);
                            link.set({ order: i });
                        });
                        window.related_content_builder.save();
                    }
                });
            }
            
            return this;
        },
        
        render: function() {
            var el = this.el;
            $(el).empty();
            this.collection.each(function(link, i, links) {
                $(el).append(link.view.el);
            });
        },
        
        addLink: function(link) {
            $(this.el).append(link.view.el);
        }
    });
    
    
    // build a related content module
    // tinymce should call this
    window.RelatedContentBuilder = Backbone.View.extend({
        
        el: '#navis-related-content-form',
        
        events: {
            'click input.add' : 'addLink',
            'keyup #related-search-field' : 'search'
        },
        
        initialize: function(options) {
            _.extend(this, options);
            _.bindAll(this);
            $('#tabs').tabs();
            
            this.search = new LinkListView({
                el: '#related-search-results',
                collection: new LinkList([], {name: 'search'})
            });
            this.search.collection.fetch();
            
            this.topic_search = new LinkListView({
                el: '#related-search-topic-results',
                collection: new LinkList([], {name: 'search'})
            });
            this.topic_search.collection.fetch({ data: { post_type: 'topic' }});
            
            this.links = new LinkListView({
                el: "#chosen-links",
                collection: new LinkList([], {name: 'links'}),
                sortable: true
            });
            
            this.topics = new LinkListView({
                el: "#chosen-topics",
                collection: new LinkList([], {name: 'topics'}),
                sortable: true
            });
            
            // order search results by date
            this.search.collection.comparator = function(link) {
                return -Date.parse(link.get('date'));
            }
            
            var that = this;
            this.model = new RelatedContentModule;
            this.model.bind('change', function(module) {
                that.links.collection.reset(module.get('links'));
                that.topics.collection.reset(module.get('topics'));
            });
            
            // and just in case, save everything if the post is updated
            $('form').submit(function() {
                that.save();
            });
            
            return this;
        },
        
        search: function(e) {
            this.searchPosts();
            this.searchTopics();
        },
        
        searchPosts: function() {
            var query = this.$('#related-search-field').val();
            if (query.length > 3) {
                this.search.collection.fetch({ 
                    data: {
                        s: query
                    }
                });
            } else if (query.length == 0) {
                this.search.collection.fetch();
            }
            return this;
        },
        
        searchTopics: function() {
            var query = this.$('#related-search-field').val();
            if (query.length > 3) {
                this.topic_search.collection.fetch({ 
                    data: {
                        s: query,
                        post_type: 'topic'
                    }
                });
            } else if (query.length == 0) {
                this.topic_search.collection.fetch();
            }
            return this;
        },
                
        addLink: function(e) {
            var title = this.$('#link-title-field'),
                url = this.$('#url-field');
                
            var link = new Link({
                title: title.val(),
                permalink: url.val(),
                type: "link"
            });
            window.related_content_builder.links.collection.add(link);
            title.val('');
            url.val('');
        },
        
        save: function() {
            this.model.set({
                links: this.links.collection.toJSON(),
                topics: this.topics.collection.toJSON()
            });
            this.model.save();
        },
        
        insertShortcode: function(align) {
            if (!this.editor) return;
            this.save();
            align = align || 'right';
            this.editor.execCommand('mceInsertContent', false, 
                '[related_content align="' + align + '"]');
        }
        
    });
        
})(window.jQuery);