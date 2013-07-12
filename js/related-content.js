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
            return this.refresh();
        },

        refresh: function() {
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
    
    var LINK_TEMPLATE = '<a target="_blank" href="<%= permalink %>">' +
                        '<% if (thumbnail && type === "topic") { %>' +
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
            this.render();
            //this.$el.on('click', 'a', this.chooseLink);
            return this;
        },
        
        render: function() {
            //console.log('Rendering: %s', this.model.get('title'));

            this.$el.attr('id', this.model.id);            
            this.$el.html(this.template(this.model.toJSON()));
            //this.delegateEvents();
            return this;
        },
        
        _chooseLink: function(e) {
            console.log('%s: %s', this.model.collection.name, this.model.get('title'));
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
            // re-render once we're done
            this.render();
        },

        chooseLink: function(e) {
            e.preventDefault();
            var current = this.model.collection.name
              , type = this.model.get('type');

            this.model.collection.trigger('chooselink', this.model, {
                from: current,
                type: type
            });

            this.model.collection.remove(this.model);
        }
    });
    
    // view for a collection of links of any type
    window.LinkListView = Backbone.View.extend({
        
        initialize: function(options) {
            //_.bindAll(this);
            this.collection.on('reset', this.render, this);
            this.collection.on('add', this.addLink, this);
            this.collection.on('remove', this.removeLink, this);

            var that = this;
            if (options.sortable) {
                var $el = $(this.el);
                $el.sortable({
                    cursor: 'pointer',
                    update: function(event, ui) {
                        $el.children('div.link').each(function(i) {
                            var id = $(this).attr('id');
                            var link = that.collection.get(id);
                            link.set({ order: i });
                        });
                        //window.related_content_builder.save();
                        that.trigger('sorted');
                    }
                });
            }
            
            return this;
        },
        
        render: function() {
            console.log('Rendering: %s', this.collection.name);

            var $el = this.$el;
            $el.empty();
            this.collection.each(function(link, i, links) {
                $el.append(link.view.el);
            });
        },
        
        addLink: function(link, options) {
            window.link = link;
            //this.$el.append(link.view.el);
            link.view.$el.appendTo(this.$el);
            console.log('Adding [%s] to [%s]', link.get('title'), this.collection.name);
            this.trigger('sorted');
        },

        removeLink: function(link, options) {
            //console.log(window.link = link);
            link.view.remove();
        }
    });
    
    
    // build a related content module
    // tinymce should call this
    window.RelatedContentBuilder = Backbone.View.extend({
        
        el: '#navis-related-content-form',
        
        /**
        _.bind throws an error when view.delegateEvents is called
        with this hash. I'm not sure why.
        **/
        _events: {
            'click input.add' : 'addLink',
            'keyup #related-search-field' : 'search'
        },
        
        initialize: function(options) {
            _.extend(this, options);
            
            _.bindAll(this, 'addLink', 'search', 'searchPosts', 'searchTopics');
            $('#tabs').tabs();

            // binding by hand here
            this.$el.on('click', 'input.add', this.addLink);
            this.$el.on('keyup', '#related-search-field', this.search);
            
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
            this.model.on('change', function(module) {
                that.links.collection.reset(module.get('links'));
                that.topics.collection.reset(module.get('topics'));
            });

            _.each(['search', 'topic_search', 'links', 'topics'], function(view) {
                var view = that[view];
                view.collection.on('chooselink', that.chooselink, that);
                view.on('sorted', that.update, that);
            });
            
            // and just in case, save everything if the post is updated
            $('form').submit(function() {
                that.save();
            });
            
            return this;
        },

        chooselink: function(link, options) {
            var type = link.get('type'), dest;
            if (options.from === 'search') {
                // adding this link to the module, send it to its proper place
                dest = type === 'topic' ? this.topics.collection : this.links.collection;
            } else {
                // send it back to search
                dest = this.search.collection;
            }

            console.log('Moving %s: %s', link.get('type'), link.get('title'));
            console.log('From: %s', options.from);
            console.log('To: %s', dest.name);

            dest.add(link);
        },
        
        search: function(e) {
            this.searchPosts();
            this.searchTopics();
        },
        
        searchPosts: function() {
            var query = $('#related-search-field').val();
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
            var query = $('#related-search-field').val();
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
            var title = $('#link-title-field'),
                url = $('#url-field');
                
            var link = new Link({
                title: title.val(),
                permalink: url.val(),
                type: "link"
            });
            this.links.collection.add(link);
            title.val('');
            url.val('');
        },
        
        save: function() {
            this.update();
            this.model.save();
        },

        update: function() {
            this.model.set({
                links: this.links.collection.toJSON(),
                topics: this.topics.collection.toJSON()
            });
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